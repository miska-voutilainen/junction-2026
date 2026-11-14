/**
 * The model steps of a review, in the order that makes it blind-first: A1 writes
 * the expectation from the requirement alone, then A2 reads the code with that
 * expectation in hand, A3 reviews the area checklists against the claims and A4
 * tests the author description last. Each step here is one client call; A5's
 * calls live in `differential/runDifferentialTests.ts` (T14). `runIndex` keys repeated eval runs apart in the
 * recordings. Spec section 6.
 */
import type { ModelClient } from "../ai/client";
import type { Requirement, Review } from "../contracts";
import * as a1 from "../prompts/a1";
import * as a2 from "../prompts/a2";
import * as a3 from "../prompts/a3";
import * as a4 from "../prompts/a4";
import type { PromptContext } from "./promptContext";

type Hunk = Review["hunks"][number];

/** A1: what a correct change must do, from the requirement alone. */
export async function writeBlindExpectation(
  client: ModelClient,
  requirement: Requirement,
  runIndex: number,
): Promise<a1.A1Output> {
  return client.call({
    promptVersion: a1.version,
    system: a1.system,
    prompt: a1.render({ requirement }),
    schema: a1.outputSchema(requirement),
    runIndex,
  });
}

/** What A2 reads besides the requirement and the context. */
export interface ChangeStoryInput {
  requirement: Requirement;
  hunks: readonly Hunk[];
  context: PromptContext;
  /** A1's output; null in anchored mode. */
  expectation: a1.A1Output | null;
  /** The author's description; null in blind-first mode. */
  authorDescription: string | null;
  runIndex: number;
}

/** A2: the story and the claims, before the quote check. */
export async function writeChangeStory(
  client: ModelClient,
  input: ChangeStoryInput,
): Promise<a2.A2Output> {
  const { requirement, hunks, context, expectation, authorDescription, runIndex } = input;
  return client.call({
    promptVersion: a2.version,
    system: a2.system,
    prompt: a2.render({
      requirement,
      context,
      expectation: expectation === null ? null : JSON.stringify(expectation, null, 2),
      authorDescription,
    }),
    schema: a2.outputSchema({ requirement, hunks }),
    runIndex,
  });
}

type Claim = Review["claims"][number];

/** What A3 reads besides the requirement: the code, A1's expectation and A2's checked claims. */
export interface AreaReviewInput {
  requirement: Requirement;
  hunks: readonly Hunk[];
  context: PromptContext;
  expectation: a1.A1Output;
  claims: readonly Claim[];
  runIndex: number;
}

/** A3: findings and refusals, before the quote check. */
export async function writeAreaReview(
  client: ModelClient,
  input: AreaReviewInput,
): Promise<a3.A3Output> {
  const { requirement, hunks, context, expectation, claims, runIndex } = input;
  return client.call({
    promptVersion: a3.version,
    system: a3.system,
    prompt: a3.render({
      requirement,
      context,
      expectation: JSON.stringify(expectation, null, 2),
      claims: claimsForPrompt(claims),
    }),
    schema: a3.outputSchema(hunks),
    runIndex,
  });
}

/** What A4 reads: the description, A2's story and its checked claims. */
export interface ContradictionCheckInput {
  authorDescription: string;
  story: a2.A2Output["story"];
  claims: readonly Claim[];
  runIndex: number;
}

/** A4: each sentence of the author description against the claims. */
export async function checkAuthorDescription(
  client: ModelClient,
  input: ContradictionCheckInput,
): Promise<a4.A4Output> {
  const { authorDescription, story, claims, runIndex } = input;
  return client.call({
    promptVersion: a4.version,
    system: a4.system,
    prompt: a4.render({
      authorDescription,
      story: JSON.stringify(story, null, 2),
      claims: claimsForPrompt(claims),
    }),
    schema: a4.outputSchema({ authorDescription, claimIds: claims.map((claim) => claim.id) }),
    runIndex,
  });
}

/** Claims with their ids, levels and quotes; the evidence blocks add nothing A3 and A4 need. */
function claimsForPrompt(claims: readonly Claim[]): string {
  return JSON.stringify(
    claims.map(({ id, text, kind, level, hunkIds, citations }) => ({
      id,
      text,
      kind,
      level,
      hunkIds,
      citations,
    })),
    null,
    2,
  );
}
