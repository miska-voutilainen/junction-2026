import { beforeAll, describe, expect, it } from "vitest";
import type { ReceiptRecord, Review } from "@/contracts";
import { loadChanges, loadReceipt, loadReportCard, loadReview } from "@/lib/data/loaders";
import { applyEscapes, levelsFromReportCard } from "@/rules/ladder";
import { buildInboxModel, filterCounts, filterRows, isReviewed, mobileSections } from "./inboxModel";
import type { InboxSource, ReviewedRow } from "./inboxModel";

// The committed fixtures stand in for recorded reviews: four Tieto changes, one signed.
let sources: InboxSource[];
let levels: ReturnType<typeof levelsFromReportCard>;

beforeAll(async () => {
  const changes = await loadChanges();
  const reportCard = await loadReportCard();
  if (changes.status !== "ok" || reportCard.status !== "ok") throw new Error("fixtures are missing");
  levels = levelsFromReportCard(reportCard.data);
  sources = await Promise.all(
    changes.data.map(async (change) => {
      const review = await loadReview(change.id);
      const receipt = await loadReceipt(change.id);
      return {
        change,
        review: review.status === "ok" ? ({ state: "ok", data: review.data } as const) : ({ state: "missing" } as const),
        receipt: receipt.status === "ok" ? receipt.data : null,
      };
    }),
  );
});

function withReview(source: InboxSource, edit: (review: Review) => Review): InboxSource {
  if (source.review.state !== "ok") throw new Error("expected a review");
  return { ...source, review: { state: "ok", data: edit(source.review.data) } };
}

describe("buildInboxModel", () => {
  it("lists every change, sorted by tier (Full first) and then by id", () => {
    const { rows } = buildInboxModel(sources, levels);
    expect(rows).toHaveLength(sources.length);
    const order = { full: 0, focused: 1, light: 2 };
    const reviewed = rows.filter(isReviewed);
    for (let index = 1; index < reviewed.length; index++) {
      const previous = reviewed[index - 1];
      const current = reviewed[index];
      expect(order[previous.tier] <= order[current.tier]).toBe(true);
      if (previous.tier === current.tier) expect(previous.id < current.id).toBe(true);
    }
  });

  it("adds up tiers, signed changes and the hunks a human reads", () => {
    const { rows, summary } = buildInboxModel(sources, levels);
    const reviewed = rows.filter(isReviewed);
    expect(summary.changes).toBe(rows.length);
    expect(summary.tierCounts.light + summary.tierCounts.focused + summary.tierCounts.full).toBe(reviewed.length);
    expect(summary.signed).toBe(reviewed.filter((row) => row.receipt === "signed").length);
    expect(summary.readHunks).toBe(reviewed.reduce((total, row) => total + row.readHunks, 0));
    expect(summary.totalHunks).toBe(reviewed.reduce((total, row) => total + row.totalHunks, 0));
  });

  it("gives each reviewed row one coverage cell per hunk", () => {
    for (const row of buildInboxModel(sources, levels).rows.filter(isReviewed)) {
      expect(row.coverage).toHaveLength(row.totalHunks);
      expect(row.coverage.filter((state) => state === "read")).toHaveLength(row.readHunks);
    }
  });

  it("picks the first unsigned change in inbox order for Review next", () => {
    const { rows, reviewNext } = buildInboxModel(sources, levels);
    expect(reviewNext?.id).toBe(rows.filter(isReviewed).find((row) => row.receipt !== "signed")?.id);
  });

  it("has nothing to review next when every change is signed", () => {
    const signedAll = sources.map((source) => {
      if (source.review.state !== "ok") return source;
      const receipt = {
        receipt: { diffSha256: source.review.data.diff.diffSha256, owner: "eliasnorta" },
      } as unknown as ReceiptRecord;
      return { ...source, receipt };
    });
    const model = buildInboxModel(signedAll, levels);
    expect(model.reviewNext).toBeNull();
    expect(model.summary.signed).toBe(sources.length);
  });

  it("marks a receipt for an older diff as stale and still asks for review", () => {
    const [first, ...rest] = sources;
    const staleReceipt = { receipt: { diffSha256: "0".repeat(64), owner: "Kasanen" } } as unknown as ReceiptRecord;
    const model = buildInboxModel([{ ...first, receipt: staleReceipt }, ...rest], levels);
    const row = model.rows.find((candidate) => candidate.id === first.change.id) as ReviewedRow;
    expect(row.receipt).toBe("stale");
    expect(model.summary.signed).toBeLessThan(model.summary.changes);
  });

  it("shows a missing or unreadable review as a row without tier, and leaves it out of the counts", () => {
    const [first, second, ...rest] = sources;
    const model = buildInboxModel(
      [{ ...first, review: { state: "missing" } }, { ...second, review: { state: "unreadable" } }, ...rest],
      levels,
    );
    expect(model.rows.find((row) => row.id === first.change.id)?.state).toBe("missing");
    expect(model.rows.find((row) => row.id === second.change.id)?.state).toBe("unreadable");
    expect(model.rows.slice(-2).every((row) => !isReviewed(row))).toBe(true);
    expect(model.summary.changes).toBe(sources.length);
    expect(model.reviewNext === null || isReviewed(model.reviewNext)).toBe(true);
  });

  it("re-routes when an escape drops an area a level", () => {
    const before = buildInboxModel(sources, levels).summary;
    const allShadow = applyEscapes(levels, { generator: 3, analyzer: 3, security: 3, performance: 3 });
    const after = buildInboxModel(sources, allShadow).summary;
    // Shadow areas make a human read every hunk in them, even ones with verified claims.
    expect(after.readHunks).toBeGreaterThan(before.readHunks);
  });

  it("counts a contradiction finding on the row", () => {
    const withContradiction = withReview(sources[0], (review) => ({
      ...review,
      findings: [
        ...review.findings.filter((finding) => finding.kind !== "contradiction"),
        { ...review.findings[0], kind: "contradiction" } as Review["findings"][number],
      ],
    }));
    const row = buildInboxModel([withContradiction], levels).rows[0] as ReviewedRow;
    expect(row.contradictions).toBe(1);
  });
});

describe("filters and mobile sections", () => {
  it("filters by receipt status and counts each filter", () => {
    const { rows } = buildInboxModel(sources, levels);
    const counts = filterCounts(rows);
    expect(counts.all).toBe(rows.length);
    expect(filterRows(rows, "signed")).toHaveLength(counts.signed);
    expect(counts.signed + counts["needs-review"] + counts.stale).toBe(rows.filter(isReviewed).length);
  });

  it("keeps unreviewed rows out of every status filter but All", () => {
    const rows = buildInboxModel([{ ...sources[0], review: { state: "missing" } }], levels).rows;
    expect(filterRows(rows, "all")).toHaveLength(1);
    expect(filterRows(rows, "needs-review")).toHaveLength(0);
  });

  it("puts Light and stale changes under Sign here, Focused and Full under Needs a desktop, signed apart", () => {
    const { rows } = buildInboxModel(sources, levels);
    const sections = mobileSections(rows);
    expect(sections.signHere.length + sections.needsDesktop.length + sections.signed.length).toBe(rows.length);
    for (const row of sections.signHere) expect(row.tier === "light" || row.receipt === "stale").toBe(true);
    for (const row of sections.needsDesktop.filter(isReviewed)) expect(row.tier).not.toBe("light");
    for (const row of sections.signed) expect(row.receipt).toBe("signed");
  });
});
