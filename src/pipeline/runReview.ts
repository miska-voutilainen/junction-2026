/**
 * One review, step by step. Blind-first: A1 writes the expectation from the
 * requirement alone, A2 reads the code and makes claims, the quote check tests
 * every quote, A3 reviews the area checklists and refuses what belongs to a
 * person, and only then does A4 read the author's description and test it
 * against the claims. Anchored (the comparison): A2 reads the description first,
 * with no A1, and A3 is skipped (a step list can switch steps off). The order is the idea: in blind-first mode
 * nothing the author said reaches A1, A2 or A3. Spec section 6.
 */
import type { ModelClient } from "../ai/client";
import type { ChangeInput, LadderLevel, Area, Requirement, Review } from "../contracts";
import { loadDiff, readFileAtCommit } from "../lib/git";
import * as a1 from "../prompts/a1";
import * as a2 from "../prompts/a2";
import * as a3 from "../prompts/a3";
import * as a4 from "../prompts/a4";
import { assembleReview } from "./assembleReview";
import {
  checkAreaFindings,
  checkContradictions,
  checkRefusals,
  fixedRefusalsFor,
  type UnnumberedRefusal,
} from "./checkFindings";
import { buildPromptContext } from "./promptContext";
import { checkClaims, type SideReader } from "./quoteCheck";
import {
  checkAuthorDescription,
  writeAreaReview,
  writeBlindExpectation,
  writeChangeStory,
} from "./steps";
import type { UsageTally } from "./usageTally";

/** A model step of the pipeline; A5 (tests) is not a model step here. */
export type ModelStep = "a1" | "a2" | "a3" | "a4";

const allSteps: readonly ModelStep[] = ["a1", "a2", "a3", "a4"];
const anchoredSteps: readonly ModelStep[] = ["a2", "a4"];

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
   * The model steps to run; A2 always runs. Defaults to every step for
   * blind-first and A2 and A4 for anchored. The blind comparison runs are
   * A1, A2 and A4: A3 is most of the cost and is not what they compare.
   * A3 needs A1's expectation.
   */
  steps?: readonly ModelStep[];
  /** Keys repeated runs apart in the recordings; 0 for the recorded review. */
  runIndex?: number;
}

/**
 * Runs the pipeline's model steps and returns the review. A5 (differential tests)
 * is not part of this function; its prompt version stays "none".
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
  const steps = new Set(input.steps ?? (isAnchored ? anchoredSteps : allSteps));
  if (steps.has("a3") && !steps.has("a1"))
    throw new Error("A3 needs A1's expectation. Add a1 to the steps or drop a3.");
  if (isAnchored && steps.has("a1"))
    throw new Error("Anchored mode shows A2 the description, so A1 cannot run. Drop a1 from the steps.");

  const expectation = steps.has("a1") ? await writeBlindExpectation(client, requirement, runIndex) : null;
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
  console.error(
    `quote check removed ${checkedClaims.hunkIdsRemoved} hunk ids that no passing citation lay in`,
  );
  const { claims, quoteCheck } = checkedClaims;

  const areaReview =
    expectation === null || !steps.has("a3")
      ? null
      : await writeAreaReview(client, {
          requirement,
          hunks: loadedDiff.hunks,
          context,
          expectation,
          claims,
          runIndex,
        });
  const areaFindings = areaReview
    ? await checkAreaFindings(areaReview.findings, readSide, quoteCheck)
    : [];
  const refusals = areaReview
    ? mergeFixedRefusals(checkRefusals(areaReview.refusals, quoteCheck), fixedRefusalsFor(loadedDiff.hunks))
    : [];

  const description = steps.has("a4")
    ? await checkAuthorDescription(client, {
        authorDescription: change.authorDescription.text,
        story: answer.story,
        claims,
        runIndex,
      })
    : null;
  const contradictions = description
    ? await checkContradictions(description.statements, claims, loadedDiff.hunks, readSide, quoteCheck)
    : [];

  const finishedAt = new Date();
  return assembleReview({
    change,
    requirement,
    loadedDiff,
    expectation,
    story: answer.story,
    checkedClaims,
    mode,
    findings: [...areaFindings, ...contradictions].map((finding, index) => ({
      ...finding,
      id: `f${index + 1}`,
    })),
    refusals: refusals.map((refusal, index) => ({ ...refusal, id: `r${index + 1}` })),
    promptVersions: {
      a1: expectation ? a1.version : "none",
      a2: a2.version,
      a3: areaReview ? a3.version : "none",
      a4: description ? a4.version : "none",
      a5: "none",
    },
    levels: input.levels,
    run: {
      id: runId(startedAt),
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      usage: input.usage.totals(),
    },
  });
}

/**
 * The AI's refusals plus the fixed ones, without counting one decision twice:
 * a rule refusal is added only for the matched hunks no AI refusal with the
 * same rule id already lists (spec section 5, Policy). An AI R7 on the hunk a
 * fixed R7 matches already makes the person decide it.
 */
export function mergeFixedRefusals(
  aiRefusals: readonly UnnumberedRefusal[],
  fixedRefusals: readonly UnnumberedRefusal[],
): UnnumberedRefusal[] {
  const addedFixed = fixedRefusals.flatMap((fixed) => {
    const listed = new Set(
      aiRefusals.filter((refusal) => refusal.ruleId === fixed.ruleId).flatMap((refusal) => refusal.hunkIds),
    );
    const hunkIds = fixed.hunkIds.filter((id) => !listed.has(id));
    return hunkIds.length === 0 ? [] : [{ ...fixed, hunkIds }];
  });
  return [...aiRefusals, ...addedFixed];
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
  const texts = new Map<string, string>();
  for (const file of files) {
    if (file.kind !== "source" && file.kind !== "test") continue;
    const text = await readFileAtCommit(repoDir, headSha, file.path);
    if (text !== null) texts.set(file.path, text);
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
