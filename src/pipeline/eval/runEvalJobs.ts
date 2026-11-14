/**
 * The eval's run schedule: which reviews to record, and how. Planted-bug
 * variants get one blind run each (A1 to A3); every contradiction plant gets
 * `runsPerMode` blind runs (A1, A2, A4) and as many anchored runs (A2 with the
 * description first, A4). Runs are staged: a run whose file already exists for
 * the current reviewer version is reused, so asking for 3 runs after 2 only
 * makes the third. Spec section 5 (pnpm evals) and 9.1 (T16).
 */
import type { AnswerKey, Review } from "../../contracts";
import { reviewerVersion } from "../assembleReview";
import { anchoredSteps, blindComparisonSteps, type ModelStep } from "../runReview";

/** One review to record. */
export interface EvalJob {
  /** What the progress line calls it: "v03", "cp1 blind 2". */
  label: string;
  /** The change input to review; `cp0` has none of its own and reviews mp-2283. */
  changeInputId: string;
  mode: Review["mode"];
  steps: readonly ModelStep[];
  /** Set for contradiction runs, which land in data/runs/<change>/<mode>/<k>.json. */
  comparison?: { mode: "anchored" | "blind"; runNumber: number };
}

/** What happened to one job. */
export interface EvalOutcome {
  job: EvalJob;
  status: "reused" | "ran" | "failed";
  /** The review, for reused and ran jobs. */
  review: Review | null;
  costUsd: number;
}

/** Reads and records reviews; the real one is in evalCommand.ts, tests use a fake. */
export interface EvalStore {
  /** The job's existing run, or null when there is none or it no longer validates. */
  load(job: EvalJob): Promise<Review | null>;
  /** Runs the review and writes it. @throws when the run fails. */
  record(job: EvalJob): Promise<Review>;
}

/** Calls to the model run 4 at a time (spec 9.1, T16). */
export const EVAL_CONCURRENCY = 4;

/** A run that fails (schema, refusal, timeout) is tried once more before it counts as not caught. */
const MAX_ATTEMPTS = 2;

const plantedBugSteps: readonly ModelStep[] = ["a1", "a2", "a3"];

/**
 * Groups of jobs; a group runs one job at a time and groups run side by side.
 * A blind run never sees the description, so its A1 and A2 prompts are
 * identical across the plants of one Tieto change; those runs sit in one group
 * so the first records and the rest reuse the recording instead of racing it.
 *
 * @param changeInputIdOf the change input a plant's runs review
 */
export function planEvalJobs(
  keys: readonly AnswerKey[],
  runsPerMode: number,
  changeInputIdOf: (key: AnswerKey) => string,
): EvalJob[][] {
  const groups = new Map<string, EvalJob[]>();
  const add = (groupId: string, job: EvalJob) =>
    groups.set(groupId, [...(groups.get(groupId) ?? []), job]);

  for (const key of keys.filter((candidate) => candidate.kind === "planted-bug")) {
    add(key.plantId, {
      label: key.plantId,
      changeInputId: changeInputIdOf(key),
      mode: "blind-first",
      steps: plantedBugSteps,
    });
  }
  for (const key of keys.filter((candidate) => candidate.kind === "contradiction")) {
    for (let k = 1; k <= runsPerMode; k++) {
      add(`${key.changeId}/blind/${k}`, {
        label: `${key.plantId} blind ${k}`,
        changeInputId: changeInputIdOf(key),
        mode: "blind-first",
        steps: blindComparisonSteps,
        comparison: { mode: "blind", runNumber: k },
      });
      add(`${key.plantId}/anchored/${k}`, {
        label: `${key.plantId} anchored ${k}`,
        changeInputId: changeInputIdOf(key),
        mode: "anchored",
        steps: anchoredSteps,
        comparison: { mode: "anchored", runNumber: k },
      });
    }
  }
  return [...groups.values()];
}

/**
 * Runs every job: reuses current runs, records the rest, retries a failure once.
 * Never throws for a failed run; that run is reported as "failed" and counts as
 * not caught. `onOutcome` is called as each job finishes, for progress lines.
 */
export async function runEvalJobs(
  groups: readonly EvalJob[][],
  store: EvalStore,
  onOutcome: (outcome: EvalOutcome) => void = () => {},
): Promise<EvalOutcome[]> {
  const outcomes: EvalOutcome[] = [];
  const queue = [...groups];

  async function worker(): Promise<void> {
    for (let group = queue.shift(); group; group = queue.shift()) {
      for (const job of group) {
        const outcome = await runJob(job, store);
        outcomes.push(outcome);
        onOutcome(outcome);
      }
    }
  }
  await Promise.all(Array.from({ length: EVAL_CONCURRENCY }, worker));
  return outcomes;
}

async function runJob(job: EvalJob, store: EvalStore): Promise<EvalOutcome> {
  const existing = await store.load(job);
  // A run from another reviewer version is stale: prompts changed, so it is measured again.
  if (existing && existing.reviewer.version === reviewerVersion)
    return { job, status: "reused", review: existing, costUsd: 0 };

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const review = await store.record(job);
      return { job, status: "ran", review, costUsd: review.run.usage.costUsd };
    } catch (error) {
      console.error(
        `${job.label}: attempt ${attempt} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  return { job, status: "failed", review: null, costUsd: 0 };
}
