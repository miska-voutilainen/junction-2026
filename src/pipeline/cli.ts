/**
 * Pipeline CLI: `run <changeId> [--no-tests]` records one blind-first review,
 * `check <changeId>` runs the A1 and A2 eval cases on it. Spec section 5, Pipeline CLI.
 */
import { existsSync } from "node:fs";
import { parseArgs } from "node:util";
import { createModelClientFromEnv } from "../ai/client";
import type { Review } from "../contracts";
import { levelsFromReportCard } from "../rules/ladder";
import { checkReview } from "./checkReview";
import {
  loadChangeAndRequirement,
  loadRecordedReview,
  loadReportCard,
  writeRecordedReview,
} from "./reviewFiles";
import { runReview } from "./runReview";
import { createUsageTally } from "./usageTally";

const usage = `Usage:
  pnpm pipeline run <changeId> [--no-tests]
  pnpm pipeline check <changeId>`;

/** The optional local environment file, loaded the way the seed script does. */
const localEnvironmentFile = ".env";

async function main(argv: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      "no-tests": { type: "boolean" },
      anchored: { type: "boolean" },
      run: { type: "string" },
    },
  });
  const [command, changeId] = positionals;
  if (!changeId || (command !== "run" && command !== "check")) fail(usage);

  if (command === "check") return printChecks(await loadRecordedReview(changeId));

  if (values.anchored || values.run !== undefined)
    fail("--anchored and --run are available after T13.");
  if (!values["no-tests"]) fail("A3 to A5 are available after T13. Run with --no-tests for now.");
  return recordReview(changeId);
}

async function recordReview(changeId: string): Promise<void> {
  if (existsSync(localEnvironmentFile)) process.loadEnvFile(localEnvironmentFile);
  const repoDir = process.env.SAMPLE_REPO_DIR;
  if (!repoDir)
    fail(
      "SAMPLE_REPO_DIR is not set. Point it at your clone of the fork (pnpm seed creates it); see the example environment file.",
    );

  const { change, requirement } = await loadChangeAndRequirement(changeId);
  const tally = createUsageTally();
  const review = await runReview({
    change,
    requirement,
    repoDir,
    client: createModelClientFromEnv(process.env, tally.sink),
    usage: tally,
    levels: levelsFromReportCard(await loadReportCard()),
  });
  await writeRecordedReview(review);
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
function printChecks(review: Review): void {
  for (const result of checkReview(review)) {
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
