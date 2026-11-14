/**
 * The model steps of a review, in the order that makes it blind-first: A1 writes
 * the expectation from the requirement alone, then A2 reads the code with that
 * expectation in hand. Each step is one client call; A3 to A5 join in T13.
 * Spec section 6.
 */
import type { ModelClient } from "../ai/client";
import type { Requirement, Review } from "../contracts";
import * as a1 from "../prompts/a1";
import * as a2 from "../prompts/a2";
import type { PromptContext } from "./promptContext";

type Hunk = Review["hunks"][number];

/** A1: what a correct change must do, from the requirement alone. */
export async function writeBlindExpectation(
  client: ModelClient,
  requirement: Requirement,
): Promise<a1.A1Output> {
  return client.call({
    promptVersion: a1.version,
    system: a1.system,
    prompt: a1.render({ requirement }),
    schema: a1.outputSchema(requirement),
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
}

/** A2: the story and the claims, before the quote check. */
export async function writeChangeStory(
  client: ModelClient,
  input: ChangeStoryInput,
): Promise<a2.A2Output> {
  const { requirement, hunks, context, expectation, authorDescription } = input;
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
  });
}
