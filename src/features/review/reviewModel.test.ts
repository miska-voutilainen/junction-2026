// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { Review } from "@/contracts";
import { buildInboxModel, decideChange, isReviewed } from "@/features/inbox";
import type { InboxSource, ReportCardInput } from "@/features/inbox";
import { loadChanges, loadReportCard, loadReview } from "@/lib/data/loaders";
import {
  buildNavigator,
  buildSections,
  coverageLineText,
  coveredSummary,
  evidenceAlert,
  fileName,
  highlightedLinesOf,
  hunkRange,
  hunkRawText,
  isLineHighlighted,
} from "./reviewModel";

const fixtureRoot = "data/fixtures";
const changeIds = ["mp-2129", "mp-2234", "mp-2283", "mp-2297"];

async function load(changeId: string): Promise<Review> {
  const review = await loadReview(changeId, fixtureRoot);
  if (review.status !== "ok") throw new Error(`fixture ${changeId} did not load`);
  return review.data;
}

async function readableCard(): Promise<ReportCardInput> {
  const reportCard = await loadReportCard(fixtureRoot);
  if (reportCard.status !== "ok") throw new Error("report card fixture did not load");
  return { state: "ok", data: reportCard.data };
}

async function sectionsOf(review: Review, reportCard: ReportCardInput, escapes = {}) {
  const { decision, levels } = decideChange(review, reportCard, escapes);
  return { decision, sections: buildSections(review, decision, levels) };
}

describe("evidence line", () => {
  it("names the test for a verified hunk, the checked quote for a supported one, the finding for a read one", async () => {
    const review = await load("mp-2283");
    const { sections } = await sectionsOf(review, await readableCard());
    const byHunk = Object.fromEntries([...sections.read, ...sections.covered].map((entry) => [entry.hunk.id, entry.evidence]));

    expect(byHunk.h1).toBe("Test passes on this change: GenerationTests.ClosedGenericStructFromReferencedAssembly");
    expect(byHunk.h5).toBe("Quote checked: GenerationTests.cs:120");
    expect(byHunk.h3).toContain("Catch block hides other IndexOutOfRangeExceptions");
    expect(byHunk.h3).toContain("Refused under R7");
  });

  it("says when the claim's quote is outside the hunk instead of pointing at lines the hunk doesn't show", async () => {
    const review = await load("mp-2283");
    const { sections } = await sectionsOf(review, await readableCard());
    const h7 = sections.covered.find((entry) => entry.hunk.id === "h7");
    // c5 covers h7 with a citation at GenerationTests.cs:120, which is in h5, not in h7 (lines 331-338).
    expect(h7?.evidence).toBe("Supported by c5 · quote checked at GenerationTests.cs:120, outside this hunk");
  });

  it("says why a hunk with no finding is still read: its area has no track record", async () => {
    const review = await load("mp-2283");
    const { sections } = await sectionsOf(review, { state: "missing" });
    // Without a report card every hunk is read; the generator hunk has no finding of its own.
    expect(sections.read.find((entry) => entry.hunk.id === "h1")?.evidence).toBe("Area is at Shadow: no track record");
  });

  it("throws a clear error for a hunk whose file is not in the file list", async () => {
    const review = await load("mp-2283");
    const broken = { ...review, files: review.files.filter((file) => file.path !== review.hunks[0].file) };
    const { decision, levels } = decideChange(broken, await readableCard(), {});
    expect(() => buildSections(broken, decision, levels)).toThrow(/mp-2283.*h1.*pnpm pipeline run mp-2283/);
  });
});

describe("sections", () => {
  it.each(changeIds)("%s: every hunk lands in exactly one section, in the state route() gave it", async (changeId) => {
    const review = await load(changeId);
    const { decision, sections } = await sectionsOf(review, await readableCard());
    const all = [...sections.read, ...sections.covered, ...sections.generated];

    expect(all.map((entry) => entry.hunk.id).sort()).toEqual(review.hunks.map((hunk) => hunk.id).sort());
    for (const entry of all) expect(entry.coverage).toBe(decision.coverage[entry.hunk.id]);
    expect(sections.read.every((entry) => entry.coverage === "read")).toBe(true);
    expect([...sections.covered, ...sections.generated].every((entry) => entry.coverage !== "read")).toBe(true);
    expect(sections.generated.every((entry) => entry.file.kind === "generated")).toBe(true);
  });

  it("re-routes with simulated escapes: an escape in an area makes more of its hunks read", async () => {
    const review = await load("mp-2283");
    const card = await readableCard();
    const before = decideChange(review, card, {});
    const after = decideChange(review, card, { generator: 3, analyzer: 3, security: 3, performance: 3 });
    expect(after.decision.readHunks).toBeGreaterThan(before.decision.readHunks);
    expect(Object.values(after.levels).every((level) => level === "shadow")).toBe(true);
  });
});

describe("navigator", () => {
  it("groups hunks Read this, Supported, Verified and counts them", async () => {
    const review = await load("mp-2283");
    const { sections } = await sectionsOf(review, await readableCard());
    const groups = buildNavigator(sections);

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
    const { sections } = await sectionsOf(review, { state: "missing" });
    expect(buildNavigator(sections).map((group) => group.title)).toEqual(["Read this"]);
  });

  it("folds covered generated files into one item per group and keeps them out of the read list", async () => {
    const review = await load("mp-2297");
    const { sections } = await sectionsOf(review, await readableCard());
    const verified = buildNavigator(sections).find((group) => group.title === "Verified");

    expect(sections.generated.map((entry) => entry.hunk.id)).toEqual(["h3", "h4"]);
    expect(verified?.hunkCount).toBe(2);
    expect(verified?.items).toEqual([expect.objectContaining({ label: "2 generated snapshot files", isGenerated: true, hunkId: "h3" })]);
  });
});

describe("coverage line", () => {
  it("reads the numbers of the decision", async () => {
    const { decision } = await sectionsOf(await load("mp-2283"), await readableCard());
    expect(coverageLineText(decision)).toBe("read 2 of 8 hunks · ~1 min (full read ~3 min)");
  });

  it("leaves the estimate out when nothing needs reading, as the inbox row does", async () => {
    const { decision } = await sectionsOf(await load("mp-2283"), await readableCard());
    expect(coverageLineText({ ...decision, readHunks: 0, readMinutes: 0 })).toBe("read 0 of 8 hunks (full read ~3 min)");
  });

  it("summarises covered hunks by kind", async () => {
    const { sections } = await sectionsOf(await load("mp-2283"), await readableCard());
    expect(coveredSummary(sections.covered)).toBe("3 verified · 3 supported");
  });
});

describe("one decision for every screen", () => {
  const cards: Array<[string, () => Promise<ReportCardInput>]> = [
    ["a readable report card", readableCard],
    ["a missing report card", async () => ({ state: "missing" })],
    ["an unreadable report card", async () => ({ state: "unreadable", error: "bad file" })],
  ];

  it.each(cards)("the inbox row equals the review decision for every fixture with %s", async (_name, makeCard) => {
    const card = await makeCard();
    const changes = await loadChanges(fixtureRoot);
    if (changes.status !== "ok") throw new Error("fixture changes did not load");
    const sources: InboxSource[] = await Promise.all(
      changes.data.map(async (change) => ({ change, review: { state: "ok" as const, data: await load(change.id) }, receipt: null })),
    );

    const rows = buildInboxModel(sources, card, {}).rows.filter(isReviewed);
    expect(rows).toHaveLength(changeIds.length);
    for (const row of rows) {
      const review = await load(row.id);
      const { decision } = decideChange(review, card, {});
      expect([row.tier, row.readHunks, row.totalHunks, row.readMinutes]).toEqual([
        decision.tier,
        decision.readHunks,
        decision.totalHunks,
        decision.readMinutes,
      ]);
    }
  });

  it.each(changeIds)("%s without a readable report card is Full, every hunk is read, and no reason quotes another count", async (changeId) => {
    const review = await load(changeId);
    for (const card of [{ state: "missing" }, { state: "unreadable" }] as const) {
      const { decision, isEvidenceAvailable } = decideChange(review, card, {});
      expect(isEvidenceAvailable).toBe(false);
      expect(decision.tier).toBe("full");
      expect(decision.readHunks).toBe(review.hunks.length);
      expect(Object.values(decision.coverage).every((coverage) => coverage === "read")).toBe(true);
      expect(decision.reasons.at(-1)?.ruleId).toBe("R-no-track-record");
      expect(decision.reasons.some((reason) => reason.ruleId === "R-read-share" || reason.ruleId === "R-unread")).toBe(false);
    }
  });

  it("words the alert for a missing and an unreadable card", async () => {
    const { decision } = decideChange(await load("mp-2283"), { state: "missing" }, {});
    expect(evidenceAlert("missing", decision)).toEqual({
      title: "No report card yet",
      verb: "Run",
      command: "pnpm evals",
      consequence: "Until then nothing counts as covered, so this change is Full: read 8 of 8 hunks.",
    });
    expect(evidenceAlert("unreadable", decision)).toMatchObject({ title: "Couldn't read the report card", verb: "Re-run" });
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
