/**
 * The whole pipeline as one test: re-run every recorded review with the model
 * answers replayed from data/recordings, and compare the result with the
 * committed file. A1 to A5, the quote check, the differential tests, the
 * legacy guard and route() all run for real; only the model is replayed. Any
 * difference means the code no longer produces the review the site shows.
 * Spec section 5, Pipeline CLI.
 */
import type { Review } from "../contracts";
import { createModelClientFromEnv } from "../ai/client";
import { MODEL } from "../ai/limits";
import { levelsForReviewer } from "../rules/ladder";
import {
  hasRecordedReview,
  listComparisonRuns,
  loadChangeAndRequirement,
  loadRecordedReview,
  loadRecordedRun,
  loadReportCard,
  type ComparisonRun,
} from "./reviewFiles";
import { runReview, type ModelStep } from "./runReview";
import { createUsageTally } from "./usageTally";

/** The outcome for one recorded run: the paths where the replayed review differs, empty when it matches. */
export interface ReplayResult {
  label: string;
  differences: string[];
}

/**
 * Replays the change's recorded review (unless `includesTests` is false: it
 * runs A5, which needs Docker and minutes) and each of its comparison runs.
 * @param repoDir the fork's clone (SAMPLE_REPO_DIR)
 * A run whose recording is missing is reported as a difference, with the
 * replay client's message naming the command that makes it.
 */
export async function replayChange(
  changeId: string,
  repoDir: string,
  includesTests: boolean,
): Promise<ReplayResult[]> {
  const runs: Array<ComparisonRun | undefined> = [
    ...(hasRecordedReview(changeId) ? [undefined] : []),
    ...(await listComparisonRuns(changeId)),
  ];
  const results: ReplayResult[] = [];
  for (const comparison of runs) {
    const label = comparison ? `${changeId} ${comparison.mode} ${comparison.runNumber}` : changeId;
    const recorded = comparison
      ? await loadRecordedRun(changeId, comparison)
      : await loadRecordedReview(changeId);
    if (!recorded) {
      results.push({
        label,
        differences: ["the recorded file does not match the Review contract"],
      });
      continue;
    }
    if (!includesTests && recorded.reviewer.promptVersions.a5 !== "none") continue;
    try {
      const replayed = await replayRun(changeId, repoDir, recorded, comparison?.runNumber ?? 0);
      results.push({
        label,
        differences: differencesBetween(comparable(recorded), comparable(replayed)),
      });
    } catch (error) {
      // A missing recording means a prompt's input changed since the run was recorded:
      // that is a difference too, and the other runs still get checked.
      results.push({
        label,
        differences: [`cannot replay: ${error instanceof Error ? error.message : String(error)}`],
      });
    }
  }
  return results;
}

/**
 * Runs the pipeline with the mode and steps the recorded file says it ran,
 * answering from data/recordings. Reading them from the file, not from the
 * command that made it, covers every recorder: `pnpm review run` (A1 to A5),
 * the eval's planted-bug runs (A1 to A3) and its comparison runs.
 * @param runIndex 0 for review.json, the run number for a comparison run: part of the recording key
 */
async function replayRun(
  changeId: string,
  repoDir: string,
  recorded: Review,
  runIndex: number,
): Promise<Review> {
  const { change, requirement } = await loadChangeAndRequirement(changeId);
  const tally = createUsageTally();
  return runReview({
    change,
    requirement,
    repoDir,
    // Replay whatever AI_MODE says: this check must never call the model.
    client: createModelClientFromEnv({ ...process.env, AI_MODE: "replay" }, tally.sink),
    usage: tally,
    levels: levelsForReviewer(await loadReportCard(), MODEL),
    mode: recorded.mode,
    steps: stepsThatRan(recorded),
    runIndex,
  });
}

/** The steps whose prompt version the review records, e.g. a planted-bug run's ["a1", "a2", "a3"]. */
function stepsThatRan(review: Review): ModelStep[] {
  const versions = review.reviewer.promptVersions;
  return modelSteps.filter((step) => versions[step] !== "none");
}

const modelSteps: readonly ModelStep[] = ["a1", "a2", "a3", "a4", "a5"];

/** The run fields that change on every run, whatever the code does. */
const runTimingFields = ["id", "startedAt", "finishedAt", "durationMs"] as const;

/**
 * The review without what differs on every run: the run's id and clock times.
 * A review recorded before the legacy guard has no `legacyTouchPoints`; a fresh
 * run writes an empty list, which means the same thing.
 */
function comparable(review: Review): unknown {
  const run: Partial<Review["run"]> = { ...review.run };
  for (const timing of runTimingFields) delete run[timing];
  return { ...review, run, legacyTouchPoints: review.legacyTouchPoints ?? [] };
}

/** Most differences a run lists: the first few say where to look, the rest is noise. */
const maxListedDifferences = 10;

/**
 * The JSON paths where two values differ, up to `maxListedDifferences`.
 * @example {a: 1, b: [1, 2]} against {a: 1, b: [1, 3]} gives ["b[1]: 2 -> 3"]
 */
export function differencesBetween(recorded: unknown, replayed: unknown, path = ""): string[] {
  if (Object.is(recorded, replayed)) return [];
  if (
    typeof recorded === "number" &&
    typeof replayed === "number" &&
    isRoundingOnly(recorded, replayed)
  )
    return [];
  if (Array.isArray(recorded) && Array.isArray(replayed)) {
    if (recorded.length !== replayed.length)
      return [`${path || "(root)"}: ${recorded.length} items -> ${replayed.length} items`];
    return recorded
      .flatMap((item, index) => differencesBetween(item, replayed[index], `${path}[${index}]`))
      .slice(0, maxListedDifferences);
  }
  if (isPlainObject(recorded) && isPlainObject(replayed)) {
    const keys = [...new Set([...Object.keys(recorded), ...Object.keys(replayed)])];
    return keys
      .flatMap((key) =>
        differencesBetween(recorded[key], replayed[key], path ? `${path}.${key}` : key),
      )
      .slice(0, maxListedDifferences);
  }
  return [`${path || "(root)"}: ${short(recorded)} -> ${short(replayed)}`];
}

/**
 * True when two numbers differ only by float rounding. Costs are sums of
 * per-call costs, and calls that finish in another order sum to
 * 3.0906573999999996 instead of 3.0906574: the same cost.
 */
function isRoundingOnly(recorded: number, replayed: number): boolean {
  const relativeTolerance = 1e-9;
  return Math.abs(recorded - replayed) <= relativeTolerance * Math.max(1, Math.abs(recorded));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A value cut to one readable line for the difference list. */
function short(value: unknown): string {
  const text = JSON.stringify(value) ?? "undefined";
  return text.length > 60 ? `${text.slice(0, 57)}...` : text;
}
