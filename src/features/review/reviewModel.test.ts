// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { Review } from "@/contracts";
import { loadReportCard, loadReview } from "@/lib/data/loaders";
import {
  buildNavigator,
  buildSections,
  coverageLineText,
  coveredSummary,
  decideReview,
  decisionWithoutEvidence,
  evidenceUnavailableText,
  fileName,
  highlightedLinesOf,
  hunkRange,
  hunkRawText,
  isLineHighlighted,
} from "./reviewModel";

const fixtureRoot = "data/fixtures";

async function load(changeId: string): Promise<Review> {
  const review = await loadReview(changeId, fixtureRoot);
  if (review.status !== "ok") throw new Error(`fixture ${changeId} did not load`);
  return review.data;
}

async function decide(review: Review) {
  const reportCard = await loadReportCard(fixtureRoot);
  if (reportCard.status !== "ok") throw new Error("report card fixture did not load");
  return decideReview(review, reportCard.data, {});
}

describe("evidence line", () => {
  it("names the test for a verified hunk, the checked quote for a supported one, the finding for a read one", async () => {
    const review = await load("mp-2283");
    const { decision, levels } = await decide(review);
    const { read, covered } = buildSections(review, decision, levels);
    const byHunk = Object.fromEntries([...read, ...covered].map((entry) => [entry.hunk.id, entry.evidence]));

    expect(byHunk.h1).toBe("Test passes on this change: GenerationTests.ClosedGenericStructFromReferencedAssembly");
    expect(byHunk.h5).toBe("Quote checked: GenerationTests.cs:120");
    expect(byHunk.h3).toBe("The PR says the analyzer's diagnostics are unchanged; the change adds one · Catch block hides other IndexOutOfRangeExceptions · Refused under R7");
  });

  it("says why a hunk with no finding is still read: its area has no track record", async () => {
    const review = await load("mp-2283");
    const sections = buildSections(review, decisionWithoutEvidence(review), levelsAllShadow());
    const generator = sections.read.find((entry) => entry.hunk.id === "h1");
    expect(generator?.evidence).toBe("Area is at Shadow: no track record");
  });
});

describe("sections and navigator", () => {
  it("groups hunks Read this, Supported, Verified and counts them", async () => {
    const review = await load("mp-2283");
    const { decision, levels } = await decide(review);
    const groups = buildNavigator(buildSections(review, decision, levels));

    expect(groups.map((group) => [group.title, group.hunkCount])).toEqual([
      ["Read this", 2],
      ["Supported", 3],
      ["Verified", 3],
    ]);
    expect(groups[0].items.map((item) => item.label)).toEqual([
      "MsgPack00xMessagePackAnalyzer.cs:424–439",
      "FormatterTemplate.cs:212–216",
    ]);
    expect(groups[0].items[0].area).toBe("analyzer");
  });

  it("omits groups with no hunks", async () => {
    const review = await load("mp-2283");
    const groups = buildNavigator(buildSections(review, decisionWithoutEvidence(review), levelsAllShadow()));
    expect(groups.map((group) => group.title)).toEqual(["Read this"]);
  });

  it("folds covered generated files into one item per group and keeps them out of the read list", async () => {
    const review = await load("mp-2297");
    const { decision, levels } = await decide(review);
    const sections = buildSections(review, decision, levels);
    const verified = buildNavigator(sections).find((group) => group.title === "Verified");

    expect(sections.generated.map((entry) => entry.hunk.id)).toEqual(["h3", "h4"]);
    expect(verified?.hunkCount).toBe(2);
    expect(verified?.items).toEqual([expect.objectContaining({ label: "2 generated snapshot files", isGenerated: true, hunkId: "h3" })]);
  });
});

describe("coverage line", () => {
  it("reads the numbers of the decision", async () => {
    const review = await load("mp-2283");
    const { decision } = await decide(review);
    expect(coverageLineText(decision)).toBe("read 2 of 8 hunks · ~1 min (full read ~3 min)");
  });

  it("summarises covered hunks by kind", async () => {
    const review = await load("mp-2283");
    const { decision, levels } = await decide(review);
    expect(coveredSummary(buildSections(review, decision, levels).covered)).toBe("3 verified · 3 supported");
  });
});

describe("without evidence", () => {
  it("reads every hunk at Full and says so", async () => {
    const review = await load("mp-2283");
    const decision = decisionWithoutEvidence(review);
    expect(decision.tier).toBe("full");
    expect(decision.readHunks).toBe(8);
    expect(Object.values(decision.coverage).every((coverage) => coverage === "read")).toBe(true);
    expect(evidenceUnavailableText(decision)).toBe(
      "Without a track record nothing counts as covered, so this change is now Full: read 8 of 8 hunks.",
    );
  });
});

describe("hunk text and highlights", () => {
  it("prints a hunk as unified text with its header and +, - and space prefixes", async () => {
    const review = await load("mp-2283");
    const lines = hunkRawText(review.hunks[0]).split("\n");
    expect(lines[0]).toBe("@@ -735,6 +735,9 @@");
    expect(lines.slice(1).every((line) => /^[ +-]/.test(line))).toBe(true);
    expect(lines).toHaveLength(review.hunks[0].lines.length + 1);
  });

  it("formats ranges and file names", async () => {
    const review = await load("mp-2283");
    expect(hunkRange(review.hunks[0])).toBe("735–743");
    expect(hunkRange({ ...review.hunks[0], newLines: 0 })).toBe("735");
    expect(fileName("a/b/Foo.cs")).toBe("Foo.cs");
  });

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

function levelsAllShadow() {
  return { generator: "shadow", analyzer: "shadow", security: "shadow", performance: "shadow" } as const;
}
