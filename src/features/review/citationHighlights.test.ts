// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { Review } from "@/contracts";
import { loadReview } from "@/lib/data/loaders";
import { highlightedLinesOf, highlightedLinesOfSelection, isLineHighlighted, scrollTargetOf, splitCitations } from "./citationHighlights";

async function load(changeId: string): Promise<Review> {
  const review = await loadReview(changeId, "data/fixtures");
  if (review.status !== "ok") throw new Error(`fixture ${changeId} did not load`);
  return review.data;
}

describe("line highlights", () => {
  it("marks the lines a claim cites on the cited side only", async () => {
    const review = await load("mp-2283");
    const hunk = review.hunks[0];
    const added = hunk.lines.find((line) => line.kind === "add");
    const removed = hunk.lines.find((line) => line.kind === "del");
    if (!added?.newLine || !removed?.oldLine) throw new Error("fixture hunk has no added and removed line");
    const highlights = highlightedLinesOf([
      { file: hunk.file, side: "new", startLine: added.newLine, endLine: added.newLine, quote: "" },
    ]);

    expect(isLineHighlighted(hunk, added, highlights)).toBe(true);
    expect(isLineHighlighted(hunk, removed, highlights)).toBe(false);
    expect(isLineHighlighted({ ...hunk, file: "other.cs" }, added, highlights)).toBe(false);
  });
});

describe("selection highlights", () => {
  it("highlights a claim's found citations and nothing for a retracted claim", async () => {
    const review = await load("mp-2283");
    const claim = review.claims[0];
    expect(highlightedLinesOfSelection(review, { kind: "claim", id: claim.id })).toEqual(highlightedLinesOf(claim.citations));
    expect(highlightedLinesOfSelection(review, { kind: "claim", id: "c8" })).toEqual([]);
    expect(highlightedLinesOfSelection(review, null)).toEqual([]);
  });

  it("leaves out a citation whose quote the quote check did not find", async () => {
    const review = structuredClone(await load("mp-2283"));
    const finding = review.findings[0];
    // A3 numbered this finding 2 before the check dropped its first one, so its id (f1) differs from the item id.
    review.quoteCheck.failures = [{ itemId: "a3-f2", citation: finding.citations[0], reason: "Quote is not in the cited lines." }];
    expect(splitCitations(review, finding.id, finding.citations)[0].isQuoteFound).toBe(false);
    expect(highlightedLinesOfSelection(review, { kind: "finding", id: finding.id })).toEqual([]);
  });

  it("treats a failure without a citation as matching no citation", async () => {
    const review = structuredClone(await load("mp-2283"));
    const finding = review.findings[0];
    review.quoteCheck.failures = [{ itemId: "a3-r1", citation: null, reason: 'unknown rule id "R8"' }];
    expect(splitCitations(review, finding.id, finding.citations).every((entry) => entry.isQuoteFound)).toBe(true);
  });

  it("scrolls to the focused citation when it is highlighted, else to the first line", () => {
    const first = { file: "a.cs", side: "new" as const, startLine: 1, endLine: 2 };
    const second = { file: "a.cs", side: "new" as const, startLine: 9, endLine: 9 };
    expect(scrollTargetOf([first, second], { ...second, quote: "" })).toEqual(second);
    expect(scrollTargetOf([first, second], undefined)).toEqual(first);
    expect(scrollTargetOf([first], { ...second, quote: "" })).toEqual(first);
    expect(scrollTargetOf([], undefined)).toBeNull();
  });
});
