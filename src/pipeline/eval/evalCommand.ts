/**
 * `pnpm evals [--runs <n>] [--plant-runs <n>] [--score-only]`: records the eval's runs (unless
 * scoring only), scores them against the answer keys, writes the report card,
 * routes the Tieto reviews again with the levels it measured and logs the
 * anchored-versus-blind result in docs/lessons.md. Spec section 5, Pipeline CLI.
 */
import { existsSync } from "node:fs";
import { parseArgs } from "node:util";
import { createModelClientFromEnv } from "../../ai/client";
import type { Area, AnswerKey, LadderLevel, ReportCard, Review } from "../../contracts";
import { levelsForReviewer, levelsFromReportCard } from "../../rules/ladder";
import {
  hasChangeInput,
  loadAnswerKeys,
  loadChangeAndRequirement,
  loadChangeInput,
  loadRecordedRun,
  type ComparisonRun,
  loadReportCard,
  writeRecordedReview,
  writeReportCard,
} from "../reviewFiles";
import { runReview } from "../runReview";
import { reviewerVersion } from "../assembleReview";
import { createUsageTally } from "../usageTally";
import { appendLessonsEntry } from "./lessonsLog";
import { rerouteReview, routingSpreadOf } from "./rerouteReview";
import { planEvalJobs, runEvalJobs, type EvalJob, type EvalStore } from "./runEvalJobs";
import { anchoredVsBlindVerdict, scoreReportCard, type ContradictionRuns } from "./scoreEval";

/** Comparison runs per mode and plant when `--runs` is not given (spec section 5). */
export const DEFAULT_RUNS_PER_MODE = 2;

/**
 * Blind runs per planted bug when `--plant-runs` is not given. One run flips on
 * security plants (A3 catches them in some runs and not others); three give a
 * majority vote and a per-plant rate for about 20 extra runs' cost.
 */
export const DEFAULT_PLANT_RUNS = 3;

/** The four Tieto changes: re-routed with the measured levels, and counted in the hallucination totals. */
const TIETO_CHANGE_IDS = ["mp-2129", "mp-2234", "mp-2283", "mp-2297"];

const LESSONS_FILE = "docs/lessons.md";

/** The most comparison runs per mode `--score-only` looks for; far above what the eval records. */
const MAX_RUNS_SCANNED = 50;

const usage = "Usage: pnpm evals [--runs <n>] [--plant-runs <n>] [--score-only]";

/** Runs the eval. @throws when the answer keys, runs or report card can't be read or written. */
export async function runEvalCommand(argv: string[]): Promise<void> {
  const { values } = parseArgs({
    args: argv,
    options: {
      runs: { type: "string" },
      "plant-runs": { type: "string" },
      "score-only": { type: "boolean" },
    },
  });
  const isScoreOnly = values["score-only"] === true;
  const requestedRuns = values.runs === undefined ? DEFAULT_RUNS_PER_MODE : Number(values.runs);
  if (!Number.isInteger(requestedRuns) || requestedRuns < 1)
    throw new Error(`--runs takes a whole number from 1, got "${values.runs}". ${usage}`);
  const requestedPlantRuns =
    values["plant-runs"] === undefined ? DEFAULT_PLANT_RUNS : Number(values["plant-runs"]);
  if (!Number.isInteger(requestedPlantRuns) || requestedPlantRuns < 1)
    throw new Error(
      `--plant-runs takes a whole number from 1, got "${values["plant-runs"]}". ${usage}`,
    );

  const startedAt = Date.now();
  const keys = await loadAnswerKeys();
  const costUsd = isScoreOnly ? 0 : await recordRuns(keys, requestedRuns, requestedPlantRuns);
  const runsPerMode = isScoreOnly ? await measuredRunsPerMode(keys) : requestedRuns;
  const plantRuns = isScoreOnly ? await measuredPlantRuns(keys) : requestedPlantRuns;

  const card = await scoreAndReroute(keys, runsPerMode, plantRuns, !isScoreOnly);
  const verdict = anchoredVsBlindVerdict(card.anchoredVsBlind);
  await appendLessonsEntry(LESSONS_FILE, {
    title: "Anchored versus blind-first",
    text: verdict.line,
    now: new Date(),
  });
  console.log(finalLine(card, costUsd, Date.now() - startedAt));
}

/** Records every missing run; returns what the new ones cost. */
async function recordRuns(
  keys: readonly AnswerKey[],
  runsPerMode: number,
  plantRuns: number,
): Promise<number> {
  if (existsSync(".env")) process.loadEnvFile(".env");
  const repoDir = process.env.SAMPLE_REPO_DIR;
  if (!repoDir)
    throw new Error(
      "SAMPLE_REPO_DIR is not set. Point it at your clone of the fork (pnpm seed creates it), or use --score-only.",
    );
  const levels = levelsFromReportCard(await loadReportCard());
  const store = modelStore(repoDir, levels);
  const groups = planEvalJobs(keys, runsPerMode, plantRuns, changeInputIdOf);
  const outcomes = await runEvalJobs(groups, store, (outcome) =>
    console.log(
      `${outcome.job.label} · ${outcome.status === "failed" ? "run failed" : outcome.status}`,
    ),
  );
  return outcomes.reduce((total, outcome) => total + outcome.costUsd, 0);
}

/** cp0 is the false sentence in mp-2283's own description, so it has no change input of its own. */
function changeInputIdOf(key: AnswerKey): string {
  return hasChangeInput(key.plantId) ? key.plantId : key.changeId;
}

function modelStore(repoDir: string, levels: Record<Area, LadderLevel>): EvalStore {
  return {
    load: (job) => loadRecordedRun(job.changeInputId, job.comparison),
    async record(job: EvalJob) {
      const { change, requirement } = await loadChangeAndRequirement(job.changeInputId);
      const tally = createUsageTally();
      const review = await runReview({
        change,
        requirement,
        repoDir,
        client: createModelClientFromEnv(process.env, tally.sink),
        usage: tally,
        levels,
        mode: job.mode,
        steps: job.steps,
        // Comparison runs number from 1; a planted bug's first run is run index 0. The
        // index is part of the recording key, so runs 2..n are new model calls.
        runIndex: job.comparison?.runNumber ?? 0,
      });
      await writeRecordedReview(review, job.comparison);
      return review;
    },
  };
}

/** The highest run number any plant has on disk, so a score-only report says "of 10" after two runs. */
async function measuredRunsPerMode(keys: readonly AnswerKey[]): Promise<number> {
  const contradictionKeys = keys.filter((key) => key.kind === "contradiction");
  let highest = 0;
  for (let k = 1; k <= MAX_RUNS_SCANNED; k++) {
    const runs = await Promise.all(
      contradictionKeys.flatMap((key) =>
        (["anchored", "blind"] as const).map((mode) =>
          loadRecordedRun(changeInputIdOf(key), { mode, runNumber: k }),
        ),
      ),
    );
    if (runs.some((run) => run !== null)) highest = k;
  }
  return highest;
}

/** The most blind runs any planted bug has on disk (run 1 is review.json), so a score-only card says "of 3" after three runs. */
async function measuredPlantRuns(keys: readonly AnswerKey[]): Promise<number> {
  const plantKeys = keys.filter((key) => key.kind === "planted-bug");
  const hasFirstRun = (
    await Promise.all(plantKeys.map((key) => loadRecordedRun(key.plantId)))
  ).some((run) => run !== null);
  let highest = hasFirstRun ? 1 : 0;
  for (let k = 2; k <= MAX_RUNS_SCANNED; k++) {
    const runs = await Promise.all(
      plantKeys.map((key) => loadRecordedRun(key.plantId, { mode: "blind", runNumber: k })),
    );
    if (runs.some((run) => run !== null)) highest = k;
  }
  return highest;
}

/** Scores the runs on disk, writes the card, then re-routes the Tieto reviews with the card's levels. */
async function scoreAndReroute(
  keys: readonly AnswerKey[],
  runsPerMode: number,
  plantRuns: number,
  dropStaleRuns: boolean,
): Promise<ReportCard> {
  const plantedBugs = await Promise.all(
    keys
      .filter((key) => key.kind === "planted-bug")
      .map(async (key) => ({
        key,
        change: await loadChangeInput(key.plantId),
        reviews: await loadPlantRuns(key.plantId, plantRuns, dropStaleRuns),
      })),
  );
  const contradictions: ContradictionRuns[] = await Promise.all(
    keys
      .filter((key) => key.kind === "contradiction")
      .map(async (key) => ({
        key,
        anchored: await loadRuns(changeInputIdOf(key), "anchored", runsPerMode, dropStaleRuns),
        blind: await loadRuns(changeInputIdOf(key), "blind", runsPerMode, dropStaleRuns),
      })),
  );
  const tietoReviews = (
    await Promise.all(TIETO_CHANGE_IDS.map((id) => loadRecordedRun(id)))
  ).filter((review): review is Review => review !== null);

  const measured = scoreReportCard({
    plantedBugs,
    contradictions,
    runsPerMode,
    otherReviews: tietoReviews,
    now: new Date(),
  });
  // The new levels count only for the model the eval measured; a review by another model stays Shadow.
  const rerouted = tietoReviews.map((review) =>
    rerouteReview(review, levelsForReviewer(measured, review.reviewer.model)),
  );
  const card = { ...measured, routingSpread: routingSpreadOf(rerouted) };

  await writeReportCard(card);
  for (const review of rerouted) await writeRecordedReview(review);
  return card;
}

/** A planted bug's runs: run 1 is review.json, run k >= 2 is blind/<k>.json. */
function loadPlantRuns(
  plantId: string,
  count: number,
  dropStaleRuns: boolean,
): Promise<(Review | null)[]> {
  return Promise.all(
    Array.from({ length: count }, (_, index) =>
      loadEvalRun(
        plantId,
        index === 0 ? undefined : { mode: "blind", runNumber: index + 1 },
        dropStaleRuns,
      ),
    ),
  );
}

function loadRuns(
  changeInputId: string,
  mode: "anchored" | "blind",
  count: number,
  dropStaleRuns: boolean,
): Promise<(Review | null)[]> {
  return Promise.all(
    Array.from({ length: count }, (_, index) =>
      loadEvalRun(changeInputId, { mode, runNumber: index + 1 }, dropStaleRuns),
    ),
  );
}

/**
 * A run for scoring. It must be the run its file name says: a review of another
 * change or of the other mode would score as if it were this one. After a full
 * run, a run from another reviewer version counts as no run (not caught), so
 * the report card is still written; `--score-only` keeps the stricter check in
 * scoreReportCard, which refuses mixed versions.
 *
 * @throws when the file holds another change or mode.
 */
export async function loadEvalRun(
  changeInputId: string,
  comparison: ComparisonRun | undefined,
  dropStaleRuns: boolean,
): Promise<Review | null> {
  const review = await loadRecordedRun(changeInputId, comparison);
  if (review === null) return null;
  const expectedMode = comparison?.mode === "anchored" ? "anchored" : "blind-first";
  if (review.changeId !== changeInputId || review.mode !== expectedMode)
    throw new Error(
      `The run for ${changeInputId} (${expectedMode}) holds ${review.changeId} (${review.mode}). Delete it and run pnpm evals again.`,
    );
  if (dropStaleRuns && review.reviewer.version !== reviewerVersion) {
    console.error(
      `${changeInputId} run is from ${review.reviewer.version}, not ${reviewerVersion}: counted as no run.`,
    );
    return null;
  }
  return review;
}

/** "evals · <c>/<p> planted caught · anchored <a>/<t> · blind <b>/<t> · $<cost> · <min> min" */
function finalLine(card: ReportCard, costUsd: number, elapsedMs: number): string {
  const planted = card.areas.reduce((total, area) => total + area.planted, 0);
  const caught = card.areas.reduce((total, area) => total + area.caught, 0);
  const { anchored, blind } = card.anchoredVsBlind;
  return [
    "evals",
    `${caught}/${planted} planted caught`,
    `anchored ${anchored.caught}/${anchored.total}`,
    `blind ${blind.caught}/${blind.total}`,
    `$${costUsd.toFixed(2)}`,
    `${(elapsedMs / 60_000).toFixed(1)} min`,
  ].join(" · ");
}
