import type { Review } from "../contracts";

/** One eval case of `pnpm pipeline check`: a name, whether the recorded review meets it, and why. */
export interface CheckResult {
  name: string;
  passed: boolean;
  detail: string;
}

/**
 * The eval cases of A1 and A2 (spec section 6) run on a recorded review. A miss
 * is a measurement for docs/lessons.md, not a test failure, so this only reports.
 */
export function checkReview(review: Review): CheckResult[] {
  const results = [checkExpectationCoversItems(review), checkEveryCodeHunkIsClaimed(review)];
  if (review.changeId === "mp-2283") results.splice(1, 0, ...checkMp2283Expectation(review));
  return results;
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
