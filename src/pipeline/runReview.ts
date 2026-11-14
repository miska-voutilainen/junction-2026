/**
 * One review, step by step. Blind-first: A1 writes the expectation from the
 * requirement alone, A2 reads the code and makes claims, the quote check tests
 * every quote, A3 reviews the area checklists and refuses what belongs to a
 * person, and only then does A4 read the author's description and test it
 * against the claims. Anchored (the comparison): A2 reads the description first,
 * with no A1, and A3 is skipped. A5 (differential tests on .NET) is opt-in: it
 * runs last, on the quote-checked claims. The order is the idea: in blind-first
 * mode nothing the author said reaches A1, A2 or A3. Spec section 6.
 */
import type { ModelClient } from "../ai/client";
import type { ChangeInput, LadderLevel, Area, Requirement, Review } from "../contracts";
import { loadDiff, readFileAtCommit } from "../lib/git";
import * as a1 from "../prompts/a1";
import * as a2 from "../prompts/a2";
import * as a3 from "../prompts/a3";
import * as a4 from "../prompts/a4";
import * as a5 from "../prompts/a5";
import { assembleReview } from "./assembleReview";
import { findLegacyTouchPoints } from "./legacyTouchPoints";
import {
  checkAreaFindings,
  checkContradictions,
  checkRefusals,
  fixedRefusalsFor,
  legacyRefusalsFor,
  legacyTouchRefusalsFor,
  mergeFixedRefusals,
  type UnnumberedFinding,
  type UnnumberedRefusal,
} from "./checkFindings";
import { dockerDotnetRunner, type DotnetRunner } from "./differential/dotnetRunner";
import { runDifferentialTests } from "./differential/runDifferentialTests";
import { buildPromptContext } from "./promptContext";
import { checkClaims, type SideReader } from "./quoteCheck";
import {
  checkAuthorDescription,
  writeAreaReview,
  writeBlindExpectation,
  writeChangeStory,
} from "./steps";
import type { UsageTally } from "./usageTally";

/** A step of the pipeline. A5 writes tests with the model, then runs them on .NET. */
export type ModelStep = "a1" | "a2" | "a3" | "a4" | "a5";

/** The steps of a full blind-first review; the CLI uses this unless `--no-tests`. */
export const reviewStepsWithTests: readonly ModelStep[] = ["a1", "a2", "a3", "a4", "a5"];

// A5 is opt-in: it needs .NET and minutes per run, so only a caller that has them lists it.
const defaultBlindSteps: readonly ModelStep[] = ["a1", "a2", "a3", "a4"];

/** The blind comparison runs: A3 is most of a run's cost and is not what they compare. */
export const blindComparisonSteps: readonly ModelStep[] = ["a1", "a2", "a4"];

/** Anchored runs: A2 reads the description first, so there is no A1 and no A3. */
export const anchoredSteps: readonly ModelStep[] = ["a2", "a4"];

/** What a run needs besides the model. */
export interface RunReviewInput {
  change: ChangeInput;
  requirement: Requirement;
  /** Absolute path of the clone of the sample repository (SAMPLE_REPO_DIR). */
  repoDir: string;
  client: ModelClient;
  usage: UsageTally;
  levels: Record<Area, LadderLevel>;
  /** "anchored" shows A2 the description first and skips A1 and A3. Defaults to "blind-first". */
  mode?: Review["mode"];
  /**
   * The model steps to run; A2 always runs. Defaults to A1 to A4 for
   * blind-first (A5 only when listed) and A2 and A4 for anchored.
   * A3 and A5 need A1's expectation.
   */
  steps?: readonly ModelStep[];
  /** Keys repeated runs apart in the recordings; 0 for the recorded review. */
  runIndex?: number;
  /** Runs `dotnet` for A5; defaults to Docker. Tests pass a fake. */
  testRunner?: DotnetRunner;
}

/**
 * Runs the pipeline's steps and returns the review. A5 (differential tests) runs
 * only when `steps` lists it; otherwise its prompt version stays "none".
 *
 * @throws if git or the model fails, or an answer fails validation twice; no partial review is returned.
 */
export async function runReview(input: RunReviewInput): Promise<Review> {
  const { change, requirement, repoDir, client } = input;
  const mode = input.mode ?? "blind-first";
  const runIndex = input.runIndex ?? 0;
  const startedAt = new Date();

  const loadedDiff = await loadDiff(repoDir, change.baseSha, change.headSha);
  const headTexts = await readHeadTexts(repoDir, change.headSha, loadedDiff.files);
  const context = buildPromptContext({
    files: loadedDiff.files,
    hunks: loadedDiff.hunks,
    headTexts,
  });
  const readSide = cachedReader(repoDir, change);
  const isAnchored = mode === "anchored";
  const steps = checkedSteps(input.steps, isAnchored);

  const expectation = steps.has("a1")
    ? await writeBlindExpectation(client, requirement, runIndex)
    : null;
  const answer = await writeChangeStory(client, {
    requirement,
    hunks: loadedDiff.hunks,
    context,
    expectation,
    authorDescription: isAnchored ? change.authorDescription.text : null,
    runIndex,
  });

  // Ids follow output order and are fixed before the check, so a failure names the claim the model wrote.
  const drafts = answer.claims.map((claim, index) => ({ ...claim, id: `c${index + 1}` }));
  const checkedClaims = await checkClaims(drafts, loadedDiff.hunks, readSide);
  // The Review contract has no field for this count, so it goes to the log only.
  if (checkedClaims.hunkIdsRemoved > 0)
    console.error(
      `quote check removed ${checkedClaims.hunkIdsRemoved} hunk ids that no passing citation lay in`,
    );
  const { claims, quoteCheck } = checkedClaims;

  const didRunA3 = expectation !== null && steps.has("a3");
  const { areaFindings, refusals: aiRefusals } = didRunA3
    ? await reviewAreas(
        client,
        { requirement, hunks: loadedDiff.hunks, context, expectation, claims, runIndex },
        readSide,
        quoteCheck,
      )
    : { areaFindings: [], refusals: [] };
  // The fixed and legacy rules need no model, so they apply on every run, whichever steps ran.
  const legacyTouchPoints = await findLegacyTouchPoints({
    repoDir,
    baseSha: change.baseSha,
    files: loadedDiff.files,
    hunks: loadedDiff.hunks,
  });
  const ruleRefusals = mergeFixedRefusals(aiRefusals, [
    ...fixedRefusalsFor(loadedDiff.hunks),
    ...legacyRefusalsFor(loadedDiff.hunks),
  ]);
  const refusals = [...ruleRefusals, ...legacyTouchRefusalsFor(legacyTouchPoints, ruleRefusals)];

  const description = steps.has("a4")
    ? await checkAuthorDescription(client, {
        authorDescription: change.authorDescription.text,
        story: answer.story,
        claims,
        runIndex,
      })
    : null;
  const contradictions = description
    ? await checkContradictions(
        description.statements,
        claims,
        loadedDiff.hunks,
        readSide,
        quoteCheck,
      )
    : [];

  // The tests run last: they need the quote-checked claims, and only a claim that passed that check can become Verified.
  const tests =
    steps.has("a5") && expectation
      ? await runDifferentialTests({
          repoDir,
          change,
          requirement,
          expectation,
          claims,
          files: loadedDiff.files,
          hunks: loadedDiff.hunks,
          client,
          runIndex,
          runner: input.testRunner ?? dockerDotnetRunner,
        })
      : null;

  return assembleReview({
    change,
    requirement,
    loadedDiff,
    expectation,
    story: answer.story,
    checkedClaims: tests ? { ...checkedClaims, claims: tests.claims } : checkedClaims,
    retractions: tests?.retractions ?? [],
    inconclusiveTests: tests?.didRun ? tests.inconclusiveTests : undefined,
    mode,
    ...numberFindingsAndRefusals([...areaFindings, ...contradictions], refusals),
    promptVersions: promptVersionsFor({
      hasExpectation: expectation !== null,
      didRunA3,
      hasDescription: description !== null,
      didRunA5: tests?.didRun === true,
    }),
    legacyTouchPoints,
    levels: input.levels,
    run: runMetadata(startedAt, input.usage),
  });
}

/** Findings f1.. and refusals r1.. in output order; the model never writes ids. */
function numberFindingsAndRefusals(
  findings: readonly UnnumberedFinding[],
  refusals: readonly UnnumberedRefusal[],
) {
  return {
    findings: findings.map((finding, index) => ({ ...finding, id: `f${index + 1}` })),
    refusals: refusals.map((refusal, index) => ({ ...refusal, id: `r${index + 1}` })),
  };
}

/** The prompt version of each step that ran; "none" for a step that did not. */
function promptVersionsFor(ran: {
  hasExpectation: boolean;
  didRunA3: boolean;
  hasDescription: boolean;
  didRunA5: boolean;
}): Review["reviewer"]["promptVersions"] {
  return {
    a1: ran.hasExpectation ? a1.version : "none",
    a2: a2.version,
    a3: ran.didRunA3 ? a3.version : "none",
    a4: ran.hasDescription ? a4.version : "none",
    a5: ran.didRunA5 ? a5.version : "none",
  };
}

/** When the run started and ended, how long it took and what it cost. */
function runMetadata(startedAt: Date, usage: UsageTally): Review["run"] {
  const finishedAt = new Date();
  return {
    id: runId(startedAt),
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    usage: usage.totals(),
  };
}

/**
 * The steps to run, after checking they make sense together.
 * @throws when a step lacks what it needs (A3 and A5 need A1; anchored mode can't run A1).
 */
function checkedSteps(
  requested: readonly ModelStep[] | undefined,
  isAnchored: boolean,
): Set<ModelStep> {
  const steps = new Set(requested ?? (isAnchored ? anchoredSteps : defaultBlindSteps));
  if (steps.has("a3") && !steps.has("a1"))
    throw new Error("A3 needs A1's expectation. Add a1 to the steps or drop a3.");
  if (steps.has("a5") && !steps.has("a1"))
    throw new Error("A5 needs A1's expectation. Add a1 to the steps or drop a5.");
  if (isAnchored && steps.has("a1"))
    throw new Error(
      "Anchored mode shows A2 the description, so A1 cannot run. Drop a1 from the steps.",
    );
  return steps;
}

/** A3, then the quote check on its findings and refusals. The fixed rule refusals are added by the caller. */
async function reviewAreas(
  client: Parameters<typeof writeAreaReview>[0],
  areaInput: Parameters<typeof writeAreaReview>[1],
  readSide: Parameters<typeof checkAreaFindings>[1],
  quoteCheck: Parameters<typeof checkAreaFindings>[2],
): Promise<{
  areaFindings: Awaited<ReturnType<typeof checkAreaFindings>>;
  refusals: UnnumberedRefusal[];
}> {
  const areaReview = await writeAreaReview(client, areaInput);
  return {
    areaFindings: await checkAreaFindings(areaReview.findings, readSide, quoteCheck),
    refusals: checkRefusals(areaReview.refusals, quoteCheck),
  };
}

/** `YYYYMMDDTHHMMSSZ` in UTC, e.g. 20261114T093005Z. */
function runId(date: Date): string {
  return date.toISOString().replace(/[-:]|\.\d{3}/g, "");
}

/** Head-side text of every file the prompt shows in full; files the change deletes have none. */
async function readHeadTexts(
  repoDir: string,
  headSha: string,
  files: Review["files"],
): Promise<Map<string, string>> {
  const shown = files.filter((file) => file.kind === "source" || file.kind === "test");
  const read = await Promise.all(
    shown.map(
      async (file) => [file.path, await readFileAtCommit(repoDir, headSha, file.path)] as const,
    ),
  );
  const texts = new Map<string, string>();
  for (const [path, text] of read) {
    if (text !== null) texts.set(path, text);
  }
  return texts;
}

/** Reads cited files from git, once per side and path: many citations point at the same file. */
function cachedReader(repoDir: string, change: ChangeInput): SideReader {
  const cache = new Map<string, Promise<string | null>>();
  return (side, file) => {
    const key = `${side}:${file}`;
    let text = cache.get(key);
    if (text === undefined) {
      text = readFileAtCommit(repoDir, side === "new" ? change.headSha : change.baseSha, file);
      cache.set(key, text);
    }
    return text;
  };
}
