/**
 * Pipeline CLI: `run <changeId> [--anchored] [--run <k>] [--no-tests]` records one
 * review, `check <changeId>` runs the eval cases of A1 to A5 on it, `eval` runs the
 * planted-bug eval. Spec section 5, Pipeline CLI.
 */
import { existsSync } from "node:fs";
import { parseArgs } from "node:util";
import { createModelClientFromEnv } from "../ai/client";
import type { AnswerKey, Review } from "../contracts";
import { levelsFromReportCard } from "../rules/ladder";
import { countGenerated } from "../rules/route";
import { checkReview, loadContradictionKey } from "./checkReview";
import {
  loadChangeAndRequirement,
  loadRecordedReview,
  loadReportCard,
  writeRecordedReview,
} from "./reviewFiles";
import { runEvalCommand } from "./eval/evalCommand";
import { blindComparisonSteps, reviewStepsWithTests, runReview, type ModelStep } from "./runReview";
import { createUsageTally } from "./usageTally";

const usage = `Usage:
  pnpm review run <changeId> [--anchored] [--run <k>] [--no-tests]
  pnpm review check <changeId>
  pnpm evals [--runs <n>] [--score-only]`;

/** The sample change whose planted contradiction `check` expects an answer key for. */
const contradictionChangeId = "mp-2283";

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
    },
  });
  const [command, changeId] = positionals;
  if (!changeId || (command !== "run" && command !== "check")) fail(usage);

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
    levels: levelsFromReportCard(await loadReportCard()),
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
    `read ${routing.readHunks} of ${routing.totalHunks} hunks${generatedHunks > 0 ? ` · ${generatedHunks} generated` : ""}`,
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
  if (review.changeId === contradictionChangeId && contradictionKey === null)
    console.log(
      `SKIP  ${contradictionChangeId}: the planted contradiction is caught (answer key not found in this checkout)`,
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
