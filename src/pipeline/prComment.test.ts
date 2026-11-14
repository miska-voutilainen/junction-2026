import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ReviewSchema } from "../contracts";
import { COMMENT_MARKER, receiptExitFrom, renderReviewComment } from "./prComment";

describe("receiptExitFrom", () => {
  it("reads an exit code", () => {
    expect(receiptExitFrom("2")).toBe(2);
    expect(receiptExitFrom("0")).toBe(0);
  });

  it("is NaN for a missing or empty flag, never 0, so an unverified diff never reads as signed", () => {
    expect(receiptExitFrom(undefined)).toBeNaN();
    expect(receiptExitFrom("")).toBeNaN();
    expect(receiptExitFrom("  ")).toBeNaN();
  });
});

const review = ReviewSchema.parse(
  JSON.parse(readFileSync("data/runs/mp-2283/review.json", "utf8")),
);

const measured = review.reviewer.model;

describe("renderReviewComment", () => {
  it("starts with the marker CI uses to find and update its own comment", () => {
    expect(renderReviewComment(review, 2, measured).startsWith(COMMENT_MARKER)).toBe(true);
  });

  it("names the tier and the reading list from the recorded routing", () => {
    const comment = renderReviewComment(review, 2, measured);
    const { routing } = review;
    expect(comment).toContain(`is ${routing.tier.charAt(0).toUpperCase()}${routing.tier.slice(1)}`);
    expect(comment).toContain(`${routing.readHunks} of ${routing.totalHunks} hunks`);
  });

  it("words the cost as the recording's, so a replayed comment does not claim calls it never made", () => {
    expect(renderReviewComment(review, 0, measured)).toContain(
      `recorded with ${review.run.usage.calls} model calls, $${review.run.usage.costUsd.toFixed(2)}.`,
    );
  });

  it.each([
    [0, "Signed."],
    [1, "Stale."],
    [2, "Not signed."],
    [3, "Signature invalid."],
  ])("reads receipt exit code %i as %s", (exitCode, wording) => {
    expect(renderReviewComment(review, exitCode, measured)).toContain(`**Receipt:** ${wording}`);
  });

  it("says the receipt was not checked rather than guessing when the code is unknown", () => {
    expect(renderReviewComment(review, Number.NaN, measured)).toContain(
      "**Receipt:** Not checked.",
    );
  });

  it("stays silent about the model when the report card measured the same one", () => {
    expect(renderReviewComment(review, 0, measured)).not.toContain("Reviewer not measured");
  });

  it("says every area routes as Shadow when the card measured another model or none", () => {
    expect(renderReviewComment(review, 0, "another-model")).toContain(
      `**Reviewer not measured:** the report card measured another-model; this review ran on ${measured}, so every area routes as Shadow.`,
    );
    expect(renderReviewComment(review, 0, null)).toContain("the report card measured no model");
  });
});
