import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { AnswerKeySchema, type AnswerKey, type Review } from "../contracts";
import { findContradictionMatch } from "./eval/matchContradiction";
import { requirementItems } from "./promptContext";

/** One eval case of `pnpm review check`: a name, whether the recorded review meets it, and why. */
export interface CheckResult {
  name: string;
  passed: boolean;
  detail: string;
}

/** The Tieto change with the planted false sentence in its description, and the one with change-specific checks. */
export const MP2283_CHANGE_ID = "mp-2283";

/** Where the evidence lane keeps the planted contradiction of mp-2283's own description. */
const mp2283PlantKey = path.join("data", "sample", "answer-key", "cp0.json");

/**
 * The answer key of the false sentence in mp-2283's description, or null for any
 * other change or when the key is not there. Read only here, at check time: the
 * pipeline's prompts never see it.
 */
export async function loadContradictionKey(changeId: string): Promise<AnswerKey | null> {
  if (changeId !== MP2283_CHANGE_ID || !existsSync(mp2283PlantKey)) return null;
  return AnswerKeySchema.parse(JSON.parse(await readFile(mp2283PlantKey, "utf8")));
}

/**
 * The eval cases of A1 to A5 (spec section 6) run on a recorded review. A miss
 * is a measurement for docs/lessons.md, not a test failure, so this only reports.
 * `contradictionKey` is the planted false sentence, when the change has one.
 */
export function checkReview(
  review: Review,
  contradictionKey: AnswerKey | null = null,
): CheckResult[] {
  const coversItems = checkExpectationCoversItems(review);
  const everyHunkClaimed = checkEveryCodeHunkIsClaimed(review);
  if (review.changeId !== MP2283_CHANGE_ID) return [coversItems, everyHunkClaimed];
  return [
    coversItems,
    ...checkMp2283Expectation(review),
    everyHunkClaimed,
    checkMp2283Refusal(review),
    checkMp2283VerifiedClaim(review),
    ...(contradictionKey === null ? [] : [checkPlantedContradiction(review, contradictionKey)]),
  ];
}

/** The change silently drops diagnostics for referenced-assembly types: a documented-behaviour decision (R7) or a product call (R1). */
function checkMp2283Refusal(review: Review): CheckResult {
  const cited = review.refusals
    .filter((refusal) => refusal.source === "ai")
    .map((refusal) => refusal.ruleId);
  return {
    name: "mp-2283: A3 refuses with R7 or R1",
    passed: cited.some((ruleId) => ruleId === "R7" || ruleId === "R1"),
    // The fixed R7 triggers don't count: the case measures what the model refuses.
    detail: `model refusals: ${cited.join(", ") || "none"}`,
  };
}

/** T14's acceptance: a claim is Verified because a test failed on the base and passed on the head. */
function checkMp2283VerifiedClaim(review: Review): CheckResult {
  const verified = review.claims.filter(
    (claim) =>
      claim.level === "verified" &&
      claim.evidence.some(
        (evidence) =>
          evidence.kind === "differential-test" &&
          evidence.base?.result === "fail" &&
          evidence.head?.result === "pass",
      ),
  );
  const unsaid = (review.inconclusiveTests ?? [])
    .map((test) => `${test.testNames.join(", ")}: ${test.reason}`)
    .join("; ");
  return {
    name: "mp-2283: A5 verifies a claim with a test that fails on the base and passes on the head",
    passed: verified.length > 0,
    detail:
      verified.length > 0
        ? `claims: ${verified.map((claim) => claim.id).join(", ")}`
        : `no Verified claim; ${unsaid || "A5 left no reason"}`,
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
  const expected = requirementItems(review.requirement).map((item) => item.id);
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
  const name = "A2 lists every hunk of a non-docs, non-generated file in a claim";
  const claimed = new Set(review.claims.flatMap((claim) => claim.hunkIds));
  // Docs hunks are not required by the eval case, and generated hunks reach the model as paths only.
  const exemptFiles = new Set(
    review.files
      .filter((file) => file.kind === "docs" || file.kind === "generated")
      .map((file) => file.path),
  );
  const unclaimed = review.hunks.filter(
    (hunk) => !exemptFiles.has(hunk.file) && !claimed.has(hunk.id),
  );
  const total = review.hunks.filter((hunk) => !exemptFiles.has(hunk.file)).length;
  return {
    name,
    passed: unclaimed.length === 0,
    detail:
      unclaimed.length === 0
        ? `${total} hunks`
        : "not claimed: " + unclaimed.map((hunk) => `${hunk.id} (${hunk.file})`).join(", "),
  };
}
