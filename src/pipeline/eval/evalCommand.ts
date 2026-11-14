/**
 * `pnpm evals [--runs <n>] [--score-only]`: records the eval's runs (unless
 * scoring only), scores them against the answer keys, writes the report card,
 * routes the Tieto reviews again with the levels it measured and logs the
 * anchored-versus-blind result in docs/lessons.md. Spec section 5, Pipeline CLI.
 */
import { existsSync } from "node:fs";
import { parseArgs } from "node:util";
import { createModelClientFromEnv } from "../../ai/client";
import type { AnswerKey, ReportCard, Review } from "../../contracts";
import { levelsFromReportCard } from "../../rules/ladder";
import {
  hasChangeInput,
  loadAnswerKeys,
  loadChangeAndRequirement,
  loadChangeInput,
  loadRecordedRun,
  loadReportCard,
  writeRecordedReview,
  writeReportCard,
} from "../reviewFiles";
import { runReview } from "../runReview";
import { createUsageTally } from "../usageTally";
import { appendLessonsEntry } from "./lessonsLog";
import { rerouteReview, routingSpreadOf } from "./rerouteReview";
import { planEvalJobs, runEvalJobs, type EvalJob, type EvalStore } from "./runEvalJobs";
import { anchoredVsBlindVerdict, scoreReportCard, type ContradictionRuns } from "./scoreEval";

/** Comparison runs per mode and plant when `--runs` is not given (spec section 5). */
export const DEFAULT_RUNS_PER_MODE = 2;

/** The four Tieto changes: re-routed with the measured levels, and counted in the hallucination totals. */
const TIETO_CHANGE_IDS = ["mp-2129", "mp-2234", "mp-2283", "mp-2297"];

const LESSONS_FILE = "docs/lessons.md";

/** The most comparison runs per mode `--score-only` looks for; far above what the eval records. */
const MAX_RUNS_SCANNED = 50;

const usage = "Usage: pnpm evals [--runs <n>] [--score-only]";

/** Runs the eval. @throws when the answer keys, runs or report card can't be read or written. */
export async function runEvalCommand(argv: string[]): Promise<void> {
  const { values } = parseArgs({
    args: argv,
    options: { runs: { type: "string" }, "score-only": { type: "boolean" } },
  });
  const isScoreOnly = values["score-only"] === true;
  const requestedRuns = values.runs === undefined ? DEFAULT_RUNS_PER_MODE : Number(values.runs);
  if (!Number.isInteger(requestedRuns) || requestedRuns < 1)
    throw new Error(`--runs takes a whole number from 1, got "${values.runs}". ${usage}`);

  const startedAt = Date.now();
  const keys = await loadAnswerKeys();
  const costUsd = isScoreOnly ? 0 : await recordRuns(keys, requestedRuns);
  const runsPerMode = isScoreOnly ? await measuredRunsPerMode(keys) : requestedRuns;

  const card = await scoreAndReroute(keys, runsPerMode);
  const verdict = anchoredVsBlindVerdict(card.anchoredVsBlind);
  await appendLessonsEntry(LESSONS_FILE, {
    title: "Anchored versus blind-first",
    text: verdict.line,
    now: new Date(),
  });
  console.log(finalLine(card, costUsd, Date.now() - startedAt));
}

/** Records every missing run; returns what the new ones cost. */
async function recordRuns(keys: readonly AnswerKey[], runsPerMode: number): Promise<number> {
  if (existsSync(".env")) process.loadEnvFile(".env");
  const repoDir = process.env.SAMPLE_REPO_DIR;
  if (!repoDir)
    throw new Error(
      "SAMPLE_REPO_DIR is not set. Point it at your clone of the fork (pnpm seed creates it), or use --score-only.",
    );
  const levels = levelsFromReportCard(await loadReportCard());
  const store = modelStore(repoDir, levels);
  const groups = planEvalJobs(keys, runsPerMode, changeInputIdOf);
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

function modelStore(repoDir: string, levels: ReturnType<typeof levelsFromReportCard>): EvalStore {
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
        // Comparison runs number from 1; the planted-bug run is run index 0.
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

/** Scores the runs on disk, writes the card, then re-routes the Tieto reviews with the card's levels. */
async function scoreAndReroute(
  keys: readonly AnswerKey[],
  runsPerMode: number,
): Promise<ReportCard> {
  const plantedBugs = await Promise.all(
    keys
      .filter((key) => key.kind === "planted-bug")
      .map(async (key) => ({
        key,
        change: await loadChangeInput(key.plantId),
        review: await loadRecordedRun(key.plantId),
      })),
  );
  const contradictions: ContradictionRuns[] = await Promise.all(
    keys
      .filter((key) => key.kind === "contradiction")
      .map(async (key) => ({
        key,
        anchored: await loadRuns(changeInputIdOf(key), "anchored", runsPerMode),
        blind: await loadRuns(changeInputIdOf(key), "blind", runsPerMode),
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
    routingSpread: routingSpreadOf([]),
    now: new Date(),
  });
  const rerouted = tietoReviews.map((review) =>
    rerouteReview(review, levelsFromReportCard(measured)),
  );
  const card = { ...measured, routingSpread: routingSpreadOf(rerouted) };

  await writeReportCard(card);
  for (const review of rerouted) await writeRecordedReview(review);
  return card;
}

function loadRuns(
  changeInputId: string,
  mode: "anchored" | "blind",
  count: number,
): Promise<(Review | null)[]> {
  return Promise.all(
    Array.from({ length: count }, (_, index) =>
      loadRecordedRun(changeInputId, { mode, runNumber: index + 1 }),
    ),
  );
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
