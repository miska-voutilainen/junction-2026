import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { AnswerKeySchema, type AnswerKey, type Review } from "../contracts";
import { findContradictionMatch } from "./eval/matchContradiction";

/** One eval case of `pnpm pipeline check`: a name, whether the recorded review meets it, and why. */
export interface CheckResult {
  name: string;
  passed: boolean;
  detail: string;
}

/** Where the evidence lane keeps the planted contradiction of mp-2283's own description. */
const mp2283PlantKey = path.join("data", "sample", "answer-key", "cp0.json");

/**
 * The answer key of the false sentence in mp-2283's description, or null for any
 * other change or when the key is not there. Read only here, at check time: the
 * pipeline's prompts never see it.
 */
export async function loadContradictionKey(changeId: string): Promise<AnswerKey | null> {
  if (changeId !== "mp-2283" || !existsSync(mp2283PlantKey)) return null;
  return AnswerKeySchema.parse(JSON.parse(await readFile(mp2283PlantKey, "utf8")));
}

/**
 * The eval cases of A1 to A4 (spec section 6) run on a recorded review. A miss
 * is a measurement for docs/lessons.md, not a test failure, so this only reports.
 * `contradictionKey` is the planted false sentence, when the change has one.
 */
export function checkReview(review: Review, contradictionKey: AnswerKey | null = null): CheckResult[] {
  const results = [checkExpectationCoversItems(review), checkEveryCodeHunkIsClaimed(review)];
  if (review.changeId === "mp-2283") {
    results.splice(1, 0, ...checkMp2283Expectation(review));
    results.push(checkMp2283Refusal(review));
    if (contradictionKey !== null) results.push(checkPlantedContradiction(review, contradictionKey));
  }
  return results;
}

/** The change silently drops diagnostics for referenced-assembly types: a documented-behaviour decision (R7) or a product call (R1). */
function checkMp2283Refusal(review: Review): CheckResult {
  const cited = review.refusals.filter((refusal) => refusal.source === "ai").map((refusal) => refusal.ruleId);
  return {
    name: "mp-2283: A3 refuses with R7 or R1",
    passed: cited.some((ruleId) => ruleId === "R7" || ruleId === "R1"),
    // The fixed R7 triggers don't count: the case measures what the model refuses.
    detail: `model refusals: ${cited.join(", ") || "none"}`,
  };
}

function checkPlantedContradiction(review: Review, key: AnswerKey): CheckResult {
  const match = findContradictionMatch(review.findings, key);
  return {
    name: "mp-2283: A4 catches the planted false statement",
    passed: match !== null,
    detail: match === null ? "no contradiction finding matches the planted sentence" : match.id,
  };
}

function checkExpectationCoversItems(review: Review): CheckResult {
  const name = "A1 covers every requirement item exactly once";
  if (review.expectation === null)
    return { name, passed: false, detail: "the review has no expectation (anchored mode)" };
  const expected = [...review.requirement.functional, ...review.requirement.nonFunctional].map(
    (item) => item.id,
  );
  const got = review.expectation.items.map((item) => item.requirementItemId);
  const missing = expected.filter((id) => !got.includes(id));
  const repeated = got.filter((id, index) => got.indexOf(id) !== index);
  const passed = missing.length === 0 && repeated.length === 0 && got.length === expected.length;
  return {
    name,
    passed,
    detail: passed
      ? `${expected.length} items`
      : `missing: ${missing.join(", ") || "none"}; repeated: ${repeated.join(", ") || "none"}`,
  };
}

/** For MP-2283 the issue is a crash in the generator and analyzer, fixed by generating a resolver. */
function checkMp2283Expectation(review: Review): CheckResult[] {
  const text = JSON.stringify(review.expectation?.items ?? []);
  return [
    {
      name: "mp-2283: A1 mentions a crash, throw or IndexOutOfRange",
      passed: /crash|throw|IndexOutOfRange/i.test(text),
      detail: "",
    },
    { name: "mp-2283: A1 mentions a resolver", passed: /resolver/i.test(text), detail: "" },
  ];
}

function checkEveryCodeHunkIsClaimed(review: Review): CheckResult {
  const name = "A2 lists every hunk of a non-docs file in a claim";
  const claimed = new Set(review.claims.flatMap((claim) => claim.hunkIds));
  const docsFiles = new Set(
    review.files.filter((file) => file.kind === "docs").map((file) => file.path),
  );
  const unclaimed = review.hunks.filter(
    (hunk) => !docsFiles.has(hunk.file) && !claimed.has(hunk.id),
  );
  const total = review.hunks.filter((hunk) => !docsFiles.has(hunk.file)).length;
  return {
    name,
    passed: unclaimed.length === 0,
    detail:
      unclaimed.length === 0
        ? `${total} hunks`
        : `not claimed: ${unclaimed.map((hunk) => `${hunk.id} (${hunk.file})`).join(", ")}`,
  };
}
