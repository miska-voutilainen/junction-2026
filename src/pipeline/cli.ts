/**
 * Pipeline CLI: `run <changeId> [--anchored] [--run <k>] [--no-tests]` records one
 * review, `check <changeId>` runs the eval cases of A1 to A5 on it, `comment <changeId>`
 * prints the pull request comment CI posts, `legacy <changeId>` adds the legacy guard to
 * its recorded runs without a model call, `eval` runs the planted-bug eval.
 * Spec section 5, Pipeline CLI.
 */
import { existsSync } from "node:fs";
import { parseArgs } from "node:util";
import { createModelClientFromEnv } from "../ai/client";
import type { AnswerKey, Review } from "../contracts";
import { MODEL } from "../ai/limits";
import { levelsForReviewer } from "../rules/ladder";
import { countGenerated } from "../rules/route";
import { MP2283_CHANGE_ID, checkReview, loadContradictionKey } from "./checkReview";
import { receiptExitFrom, renderReviewComment } from "./prComment";
import {
  hasRecordedReview,
  listComparisonRuns,
  loadChangeAndRequirement,
  loadRecordedReview,
  loadRecordedRun,
  loadReportCard,
  writeRecordedReview,
  type ComparisonRun,
} from "./reviewFiles";
import { runEvalCommand } from "./eval/evalCommand";
import { blindComparisonSteps, reviewStepsWithTests, runReview, type ModelStep } from "./runReview";
import { addLegacyGuard } from "./addLegacyGuard";
import { createUsageTally } from "./usageTally";

const usage = `Usage:
  pnpm review run <changeId> [--anchored] [--run <k>] [--no-tests]
  pnpm review check <changeId>
  pnpm review legacy <changeId>
  pnpm review comment <changeId> [--receipt-exit <code>]
  pnpm evals [--runs <n>] [--score-only]`;

/** The optional local environment file, loaded the way the seed script does. */
const localEnvironmentFile = ".env";

async function main(argv: string[]): Promise<void> {
  // `eval` takes its own flags and no change id.
  if (argv[0] === "eval") return runEvalCommand(argv.slice(1));
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      // Skips A5: the differential tests need .NET and minutes per run.
      "no-tests": { type: "boolean" },
      anchored: { type: "boolean" },
      run: { type: "string" },
      // The exit code of `pnpm countersign verify <changeId>`, so the comment can say if the diff is signed.
      "receipt-exit": { type: "string" },
    },
  });
  const [command, changeId] = positionals;
  if (!changeId || (command !== "run" && command !== "check" && command !== "comment" && command !== "legacy")) fail(usage);

  if (command === "comment") {
    const receiptExit = receiptExitFrom(values["receipt-exit"]);
    const measuredModel = (await loadReportCard())?.reviewer.model ?? null;
    console.log(
      renderReviewComment(await loadRecordedReview(changeId), receiptExit, measuredModel),
    );
    return;
  }

  if (command === "legacy") return legacyCommand(changeId);

  if (command === "check") {
    const review = await loadRecordedReview(changeId);
    return printChecks(review, await loadContradictionKey(changeId));
  }

  const runNumber = values.run === undefined ? undefined : Number(values.run);
  if (runNumber !== undefined && (!Number.isInteger(runNumber) || runNumber < 1))
    fail(`--run takes a whole number from 1, got "${values.run}".`);
  return recordReview(changeId, {
    isAnchored: values.anchored === true,
    runNumber,
    runsTests: values["no-tests"] !== true,
  });
}

/**
 * `legacy`: adds the legacy guard in place, with no model call, to the change's
 * review and to every comparison run recorded for it. The contradiction plants
 * have comparison runs only, and they must go through the guard too.
 */
async function legacyCommand(changeId: string): Promise<void> {
  if (existsSync(localEnvironmentFile)) process.loadEnvFile(localEnvironmentFile);
  const repoDir = process.env.SAMPLE_REPO_DIR;
  if (!repoDir) fail("SAMPLE_REPO_DIR is not set. Point it at your clone of the fork (pnpm seed creates it).");
  const levels = levelsForReviewer(await loadReportCard(), MODEL);
  const runs: Array<ComparisonRun | undefined> = [
    ...(hasRecordedReview(changeId) ? [undefined] : []),
    ...(await listComparisonRuns(changeId)),
  ];
  if (runs.length === 0) fail(`No recorded review or comparison run for ${changeId}. Run pnpm review run ${changeId} first.`);
  for (const comparison of runs) {
    const before = comparison ? await loadRecordedRun(changeId, comparison) : await loadRecordedReview(changeId);
    const label = comparison ? `${changeId} ${comparison.mode} ${comparison.runNumber}` : changeId;
    if (!before) fail(`${label} does not match the Review contract; runs listed above are already updated. Record it again with pnpm review run, then re-run this command (it is safe to repeat).`);
    const after = await addLegacyGuard(before, repoDir, levels);
    await writeRecordedReview(after, comparison);
    printLegacyResult(label, before, after);
  }
}

/** One line per run: the tier before and after, then one line per touch point. */
function printLegacyResult(label: string, before: Review, after: Review): void {
  const points = after.legacyTouchPoints ?? [];
  console.log(
    `${label} · ${before.routing.tier} -> ${after.routing.tier} · ${points.length} touch points` +
      points.map((point) => `
  ${point.kind} · ${point.guard.status} · ${point.hunkIds.length} hunks · ${point.detail}`).join(""),
  );
}

/** How a run is recorded: the plain run is the change's review; --anchored or --run <k> is a comparison run. */
interface RunOptions {
  isAnchored: boolean;
  runNumber: number | undefined;
  /** False with --no-tests. */
  runsTests: boolean;
}

async function recordReview(changeId: string, options: RunOptions): Promise<void> {
  if (existsSync(localEnvironmentFile)) process.loadEnvFile(localEnvironmentFile);
  const repoDir = process.env.SAMPLE_REPO_DIR;
  if (!repoDir)
    fail(
      "SAMPLE_REPO_DIR is not set. Point it at your clone of the fork (pnpm seed creates it); see the example environment file.",
    );

  const { change, requirement } = await loadChangeAndRequirement(changeId);
  const tally = createUsageTally();
  const isComparison = options.isAnchored || options.runNumber !== undefined;
  // Comparison runs number from 1; the recorded review is run index 0.
  const runNumber = options.runNumber ?? 1;
  const review = await runReview({
    change,
    requirement,
    repoDir,
    client: createModelClientFromEnv(process.env, tally.sink),
    usage: tally,
    levels: levelsForReviewer(await loadReportCard(), MODEL),
    mode: options.isAnchored ? "anchored" : "blind-first",
    steps: stepsFor(options, isComparison),
    runIndex: isComparison ? runNumber : 0,
  });
  const comparisonMode = options.isAnchored ? "anchored" : "blind";
  await writeRecordedReview(review, isComparison ? { mode: comparisonMode, runNumber } : undefined);
  console.log(summaryLine(review));
}

/** The steps of a run: comparison runs and --no-tests skip A5; the recorded review runs it (spec section 5). */
function stepsFor(options: RunOptions, isComparison: boolean): readonly ModelStep[] | undefined {
  if (options.isAnchored) return undefined;
  if (isComparison) return blindComparisonSteps;
  return options.runsTests ? reviewStepsWithTests : undefined;
}

/** "<changeId> · <tier> · read <r> of <n> hunks · <claims> claims · <findings> findings · <refusals> refused · $<cost> · <seconds> s" */
function summaryLine(review: Review): string {
  const { routing, run } = review;
  const generatedHunks = countGenerated(routing.coverage);
  return [
    review.changeId,
    routing.tier,
    `read ${routing.readHunks} of ${routing.totalHunks} hunks`,
    ...(generatedHunks > 0 ? [`${generatedHunks} generated`] : []),
    `${review.claims.length} claims`,
    `${review.findings.length} findings`,
    `${review.refusals.length} refused`,
    `$${run.usage.costUsd.toFixed(2)}`,
    `${Math.round(run.durationMs / 1000)} s`,
  ].join(" · ");
}

/** A miss is a measurement, not a failure: the exit code stays 0. */
function printChecks(review: Review, contradictionKey: AnswerKey | null): void {
  for (const result of checkReview(review, contradictionKey)) {
    const detail = result.detail ? ` (${result.detail})` : "";
    console.log(`${result.passed ? "PASS" : "MISS"}  ${result.name}${detail}`);
  }
  // A missing key is not a miss: say the case did not run, so a pass count is not read as complete.
  if (review.changeId === MP2283_CHANGE_ID && contradictionKey === null)
    console.log(
      `SKIP  ${MP2283_CHANGE_ID}: the planted contradiction is caught (answer key not found in this checkout)`,
    );
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

try {
  await main(process.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
