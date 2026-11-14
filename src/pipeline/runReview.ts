/**
 * One blind-first review, step by step: load the diff, A1 writes the expectation
 * from the requirement alone, A2 reads the code and makes claims, the quote check
 * tests every quote against the files, and route() decides what a person reads.
 * The order is the idea: nothing the author said reaches A1 or A2. Spec section 6.
 */
import type { ModelClient } from "../ai/client";
import type { ChangeInput, LadderLevel, Area, Requirement, Review } from "../contracts";
import { loadDiff, readFileAtCommit } from "../lib/git";
import { assembleReview } from "./assembleReview";
import { buildPromptContext } from "./promptContext";
import { checkClaims, type SideReader } from "./quoteCheck";
import { writeBlindExpectation, writeChangeStory } from "./steps";
import type { UsageTally } from "./usageTally";

/** What a run needs besides the model. */
export interface RunReviewInput {
  change: ChangeInput;
  requirement: Requirement;
  /** Absolute path of the clone of the sample repository (SAMPLE_REPO_DIR). */
  repoDir: string;
  client: ModelClient;
  usage: UsageTally;
  levels: Record<Area, LadderLevel>;
}

/**
 * Runs the blind-first steps of the pipeline and returns the review.
 *
 * @throws if git or the model fails, or an answer fails validation twice; no partial review is returned.
 */
export async function runReview(input: RunReviewInput): Promise<Review> {
  const { change, requirement, repoDir, client } = input;
  const startedAt = new Date();

  const loadedDiff = await loadDiff(repoDir, change.baseSha, change.headSha);
  const headTexts = await readHeadTexts(repoDir, change.headSha, loadedDiff.files);
  const context = buildPromptContext({
    files: loadedDiff.files,
    hunks: loadedDiff.hunks,
    headTexts,
  });

  const expectation = await writeBlindExpectation(client, requirement);
  const answer = await writeChangeStory(client, {
    requirement,
    hunks: loadedDiff.hunks,
    context,
    expectation,
    authorDescription: null,
  });

  // Ids follow output order and are fixed before the check, so a failure names the claim the model wrote.
  const drafts = answer.claims.map((claim, index) => ({ ...claim, id: `c${index + 1}` }));
  const checkedClaims = await checkClaims(drafts, loadedDiff.hunks, cachedReader(repoDir, change));

  const finishedAt = new Date();
  return assembleReview({
    change,
    requirement,
    loadedDiff,
    expectation,
    story: answer.story,
    checkedClaims,
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
      // A cited path that is a folder makes git say so; a citation can't be checked against it, so it fails as "not present".
      text = readFileAtCommit(
        repoDir,
        side === "new" ? change.headSha : change.baseSha,
        file,
      ).catch(() => null);
      cache.set(key, text);
    }
    return text;
  };
}
