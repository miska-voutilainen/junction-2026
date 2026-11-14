/**
 * The author never checks its own work, A5: the claims the AI made from the code
 * are tested by code the AI wrote without seeing it. For each functional
 * requirement item with a behaviour claim, A5 writes a test from the requirement
 * and A1's expectation alone. The pipeline runs it on the base and on the head of
 * the change in two throwaway worktrees; a test that fails before and passes
 * after lifts the claims to Verified. The PR's own new tests run too, but can
 * only confirm. Spec section 6, A5.
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, isAbsolute } from "node:path";
import type { ModelClient } from "../../ai/client";
import type { ChangeInput, Requirement, Review } from "../../contracts";
import { readFileAtCommit } from "../../lib/git";
import { runGit } from "../../lib/git/runGit";
import { STYLE_EXAMPLE_MAX_CHARS } from "../../policy/differentialTests";
import * as a5 from "../../prompts/a5";
import type { A1Output } from "../../prompts/a1";
import { applyOutcomes, type TestOutcome, type VerdictCounts } from "./classifyOutcomes";
import type { DotnetRunner } from "./dotnetRunner";
import { withTestWorktrees, type TestWorktrees } from "./testWorktrees";
import {
  changedTestMethods,
  chooseStyleExample,
  limitTestNames,
  prTestFiles,
  testProjectDir,
} from "./testProject";

type Claim = Review["claims"][number];

/** What the tests need from the review so far. */
export interface DifferentialTestsInput {
  repoDir: string;
  change: Pick<ChangeInput, "baseSha" | "headSha">;
  requirement: Requirement;
  /** A1's expectation: the only description of the behaviour A5 sees. */
  expectation: A1Output;
  claims: readonly Claim[];
  files: Review["files"];
  hunks: Review["hunks"];
  client: ModelClient;
  runIndex: number;
  runner: DotnetRunner;
}

/** The claims after the tests, and what the tests did. */
export interface DifferentialTestsResult {
  claims: Claim[];
  retractions: Review["retractions"];
  counts: VerdictCounts;
  /** False when there was nowhere to run a test; the step then leaves no trace in the review. */
  didRun: boolean;
}

/** A test file A5 wrote, validated against the project folder. */
interface GeneratedTest {
  requirementItemId: string;
  testFile: string;
  code: string;
  testNames: string[];
}

/**
 * Writes, runs and classifies the tests. A change that touches no test project
 * gets no tests: A5 would have nowhere to put one, and the claims stay as they were.
 *
 * @throws if git, the model or the filesystem fails; a failed test run is a result, not an error.
 */
export async function runDifferentialTests(
  input: DifferentialTestsInput,
): Promise<DifferentialTestsResult> {
  const unchanged = { ...applyOutcomes(input.claims, []), didRun: false };
  const projectDir = testProjectDir(input.files);
  if (projectDir === null) {
    console.error(
      "A5 skipped: the change touches no test project, so there is nowhere to add a test.",
    );
    return unchanged;
  }

  const generated = await writeTests(input, projectDir);
  if (generated === null) return unchanged;
  const outcomes = await withTestWorktrees(input.repoDir, input.change, (worktrees) =>
    runAllTests(input, projectDir, generated, worktrees),
  );
  const result = applyOutcomes(input.claims, outcomes);
  const { counts } = result;
  console.error(
    `A5: ${outcomes.length} test runs: ${counts["tells-apart"]} tell the versions apart, ${counts.same} do not, ` +
      `${counts["broken-on-head"]} fail on the head, ${counts.inconclusive} could not run (build error, no match or timeout).`,
  );
  return { ...result, didRun: true };
}

/** One A5 call per functional requirement item that a behaviour claim covers; null when the project has no style example. */
async function writeTests(
  input: DifferentialTestsInput,
  projectDir: string,
): Promise<GeneratedTest[] | null> {
  const styleExample = await readStyleExample(input, projectDir);
  if (styleExample === null) {
    console.error(`A5 skipped: ${projectDir} has no test file on the base to show the style.`);
    return null;
  }
  const itemIds = input.requirement.functional
    .map((item) => item.id)
    .filter((id) =>
      input.claims.some(
        (claim) =>
          claim.kind === "behaviour" && claim.requirementItemId === id && claim.hunkIds.length > 0,
      ),
    );
  const tests: GeneratedTest[] = [];
  for (const requirementItemId of itemIds) {
    const answer = await input.client.call({
      promptVersion: a5.version,
      system: a5.system,
      prompt: a5.render({
        requirement: input.requirement,
        requirementItemId,
        expectation: input.expectation,
        projectDir,
        styleExample,
      }),
      schema: a5.outputSchema({ requirementItemId, projectDir }),
      runIndex: input.runIndex,
    });
    tests.push(answer);
  }
  return tests;
}

async function readStyleExample(
  input: DifferentialTestsInput,
  projectDir: string,
): Promise<{ path: string; text: string } | null> {
  const listing = await runGit(input.repoDir, [
    "ls-tree",
    "-r",
    "--name-only",
    input.change.baseSha,
    "--",
    projectDir,
  ]);
  const path = chooseStyleExample(
    projectDir,
    listing.toString("utf8").split("\n").filter(Boolean),
    prTestFiles(input.files),
  );
  if (path === null) return null;
  const text = await readFileAtCommit(input.repoDir, input.change.baseSha, path);
  return text === null ? null : { path, text: text.slice(0, STYLE_EXAMPLE_MAX_CHARS) };
}

/** A5's tests first on clean worktrees, then the PR's own tests, which need the base to hold the PR's test files. */
async function runAllTests(
  input: DifferentialTestsInput,
  projectDir: string,
  generated: readonly GeneratedTest[],
  worktrees: TestWorktrees,
): Promise<TestOutcome[]> {
  const outcomes: TestOutcome[] = [];
  for (const test of generated) {
    const outcome = await runGeneratedTest(input, projectDir, test, worktrees);
    if (outcome !== null) outcomes.push(outcome);
  }
  const prOutcome = await runPrTests(input, projectDir, worktrees);
  return prOutcome === null ? outcomes : [...outcomes, prOutcome];
}

/** Adds A5's file to both worktrees, runs its tests on each, and removes the file again so the next test builds on a clean tree. */
async function runGeneratedTest(
  input: DifferentialTestsInput,
  projectDir: string,
  test: GeneratedTest,
  { baseDir, headDir }: TestWorktrees,
): Promise<TestOutcome | null> {
  const basePath = pathInside(baseDir, test.testFile);
  const headPath = pathInside(headDir, test.testFile);
  if (existsSync(basePath) || existsSync(headPath)) {
    console.error(
      `A5: ${test.testFile} already exists in the repository; the test for ${test.requirementItemId} was not run.`,
    );
    return null;
  }
  await writeNewFile(basePath, test.code);
  await writeNewFile(headPath, test.code);
  try {
    const request = { projectDir, testNames: test.testNames };
    const base = await input.runner({ ...request, worktreeDir: baseDir });
    const head = await input.runner({ ...request, worktreeDir: headDir });
    return {
      source: "differential-test",
      requirementItemId: test.requirementItemId,
      testNames: test.testNames,
      base,
      head,
    };
  } finally {
    await rm(basePath, { force: true });
    await rm(headPath, { force: true });
  }
}

/** The PR's new or changed test methods: the base gets the PR's test files and nothing else of the change. */
async function runPrTests(
  input: DifferentialTestsInput,
  projectDir: string,
  { baseDir, headDir }: TestWorktrees,
): Promise<TestOutcome | null> {
  const testNames: string[] = [];
  for (const file of prTestFiles(input.files)) {
    const headFile = pathInside(headDir, file.path);
    if (!existsSync(headFile)) continue;
    const text = await readFile(headFile, "utf8");
    testNames.push(...changedTestMethods(text, input.hunks, file.path));
    await writeNewFile(pathInside(baseDir, file.path), text);
  }
  const names = limitTestNames(testNames);
  if (names.length === 0) return null;
  const base = await input.runner({ worktreeDir: baseDir, projectDir, testNames: names });
  const head = await input.runner({ worktreeDir: headDir, projectDir, testNames: names });
  return { source: "pr-test", requirementItemId: null, testNames: names, base, head };
}

/**
 * Joins a repository-relative path onto a worktree and refuses a result outside
 * it. The A5 schema already rejects `..`; this stays as the last check before
 * model-written content is written to disk.
 *
 * @throws Error when the path leaves the worktree.
 */
function pathInside(worktreeDir: string, repoPath: string): string {
  const full = resolve(join(worktreeDir, repoPath));
  const outside = relative(worktreeDir, full);
  if (outside.startsWith("..") || isAbsolute(outside))
    throw new Error(`Test file path "${repoPath}" leaves the worktree. Nothing was written.`);
  return full;
}

async function writeNewFile(path: string, text: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, text, "utf8");
}
