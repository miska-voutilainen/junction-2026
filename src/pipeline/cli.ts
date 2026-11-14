/**
 * Pipeline CLI: `run <changeId> [--anchored] [--run <k>] [--no-tests]` records one
 * review, `check <changeId>` runs the eval cases of A1 to A4 on it. Spec section 5,
 * Pipeline CLI.
 */
import { existsSync } from "node:fs";
import { parseArgs } from "node:util";
import { createModelClientFromEnv } from "../ai/client";
import type { AnswerKey, Review } from "../contracts";
import { levelsFromReportCard } from "../rules/ladder";
import { checkReview, loadContradictionKey } from "./checkReview";
import {
  loadChangeAndRequirement,
  loadRecordedReview,
  loadReportCard,
  writeRecordedReview,
} from "./reviewFiles";
import { runReview } from "./runReview";
import { createUsageTally } from "./usageTally";

const usage = `Usage:
  pnpm pipeline run <changeId> [--anchored] [--run <k>] [--no-tests]
  pnpm pipeline check <changeId>`;

/** The optional local environment file, loaded the way the seed script does. */
const localEnvironmentFile = ".env";

async function main(argv: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      // Accepted for the spec's command line; A5 (T14) is not built, so no run includes tests yet.
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

  const k = values.run === undefined ? undefined : Number(values.run);
  if (k !== undefined && (!Number.isInteger(k) || k < 1))
    fail(`--run takes a whole number from 1, got "${values.run}".`);
  return recordReview(changeId, { isAnchored: values.anchored === true, k });
}

/** How a run is recorded: the plain run is the change's review; --anchored or --run <k> is a comparison run. */
interface RunOptions {
  isAnchored: boolean;
  k: number | undefined;
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
  const isComparison = options.isAnchored || options.k !== undefined;
  // Comparison runs number from 1; the recorded review is run index 0.
  const k = options.k ?? 1;
  const review = await runReview({
    change,
    requirement,
    repoDir,
    client: createModelClientFromEnv(process.env, tally.sink),
    usage: tally,
    levels: levelsFromReportCard(await loadReportCard()),
    mode: options.isAnchored ? "anchored" : "blind-first",
    runIndex: isComparison ? k : 0,
  });
  await writeRecordedReview(
    review,
    isComparison ? { mode: options.isAnchored ? "anchored" : "blind", k } : undefined,
  );
  console.log(summaryLine(review));
  const { checked, passed, downgraded } = review.quoteCheck;
  console.log(`quote check: ${checked} checked, ${passed} passed, ${downgraded} claims downgraded`);
}

/** "<changeId> · <tier> · read <r> of <n> hunks · <claims> claims · <findings> findings · <refusals> refused · $<cost> · <seconds> s" */
function summaryLine(review: Review): string {
  const { routing, run } = review;
  return [
    review.changeId,
    routing.tier,
    `read ${routing.readHunks} of ${routing.totalHunks} hunks`,
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
    console.log(
      `${result.passed ? "PASS" : "MISS"}  ${result.name}${result.detail ? ` (${result.detail})` : ""}`,
    );
  }
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

main(process.argv.slice(2)).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
