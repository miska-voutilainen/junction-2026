import { beforeAll, describe, expect, it } from "vitest";
import type { ReportCard, Review } from "@/contracts";
import type { InboxSource, ReportCardInput } from "@/features/inbox";
import { loadChanges, loadReceipt, loadReportCard, loadReview } from "@/lib/data/loaders";
import { attentionSummary, buildDashboardModel } from "./dashboardModel";

// The committed fixtures stand in for recorded data: four Tieto changes, mp-2283 signed, mp-2129 stale.
let sources: InboxSource[];
let reportCard: ReportCardInput;

beforeAll(async () => {
  const changes = await loadChanges();
  const card = await loadReportCard();
  if (changes.status !== "ok" || card.status !== "ok") throw new Error("fixtures are missing");
  reportCard = { state: "ok", data: card.data as ReportCard };
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

function withReview(id: string, edit: (review: Review) => Review): InboxSource[] {
  return sources.map((source) =>
    source.change.id === id && source.review.state === "ok"
      ? { ...source, review: { state: "ok", data: edit(source.review.data) } }
      : source,
  );
}

describe("buildDashboardModel facts", () => {
  it("counts signed changes, hunks read by a person and contradictions from the recorded reviews", () => {
    const { facts, inbox } = buildDashboardModel(sources, reportCard, {});
    expect(facts.changes).toBe(sources.length);
    expect(facts.signed).toBe(1);
    expect(facts.readHunks).toBe(inbox.summary.readHunks);
    expect(facts.totalHunks).toBe(inbox.summary.totalHunks);
    const contradictions = sources.reduce(
      (total, { review }) =>
        total + (review.state === "ok" ? review.data.findings.filter((finding) => finding.kind === "contradiction").length : 0),
      0,
    );
    expect(facts.contradictions).toBe(contradictions);
  });

  it("adds simulated escapes across areas", () => {
    expect(buildDashboardModel(sources, reportCard, { generator: 1, security: 2 }).facts.escapes).toBe(3);
  });
});

describe("accepted risk", () => {
  it("lists a signed receipt as holding and an amended one as stale, stale first", () => {
    const { acceptedRisks, hasReceipts } = buildDashboardModel(sources, reportCard, {});
    expect(hasReceipts).toBe(true);
    expect(acceptedRisks.map((risk) => [risk.changeId, risk.isStale])).toEqual([
      ["mp-2129", true],
      ["mp-2283", false],
    ]);
    expect(acceptedRisks[1].text.length).toBeGreaterThan(0);
  });

  it("has no receipts, and says so, when nobody has signed", () => {
    const unsigned = sources.map((source) => ({ ...source, receipt: null }));
    const model = buildDashboardModel(unsigned, reportCard, {});
    expect(model.hasReceipts).toBe(false);
    expect(model.facts.signed).toBe(0);
  });
});

describe("open decisions", () => {
  it("leaves out refusals a signed receipt accepted but keeps those of a stale receipt", () => {
    const withoutReceipts = buildDashboardModel(
      sources.map((source) => ({ ...source, receipt: null })),
      reportCard,
      {},
    );
    const withReceipts = buildDashboardModel(sources, reportCard, {});
    const total = (queues: typeof withReceipts.deciderQueues) => queues.reduce((sum, queue) => sum + queue.count, 0);

    const signedSource = sources.find((source) => source.change.id === "mp-2283");
    const accepted =
      signedSource?.receipt && signedSource.receipt !== "unreadable"
        ? signedSource.receipt.receipt.residualRisk.acceptedRefusalIds.length
        : 0;
    expect(accepted).toBeGreaterThan(0);
    // mp-2129's receipt is stale, so it accepts nothing; only mp-2283's accepted refusals drop out.
    expect(total(withoutReceipts.deciderQueues) - total(withReceipts.deciderQueues)).toBe(accepted);
  });

  it("groups refusals by the decider the refusal policy names, with rule title and change ids", () => {
    const model = buildDashboardModel(
      sources.map((source) => ({ ...source, receipt: null })),
      reportCard,
      {},
    );
    const deciders = model.deciderQueues.map((queue) => queue.decider);
    expect(new Set(deciders).size).toBe(deciders.length);
    for (const queue of model.deciderQueues) {
      expect(queue.count).toBe(queue.decisions.reduce((sum, decision) => sum + decision.count, 0));
      for (const decision of queue.decisions) {
        expect(decision.ruleId).toMatch(/^R\d$/);
        expect(decision.title).not.toBe(decision.ruleId);
        expect(decision.changeIds.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("attention by tier", () => {
  it("splits the hunks over Light, Focused and Full without losing any", () => {
    const { attention, facts } = buildDashboardModel(sources, reportCard, {});
    expect(attention.map((row) => row.tier)).toEqual(["light", "focused", "full"]);
    expect(attention.reduce((sum, row) => sum + row.totalHunks, 0)).toBe(facts.totalHunks);
    expect(attention.reduce((sum, row) => sum + row.readHunks, 0)).toBe(facts.readHunks);
  });

  it("describes a bar with its numbers", () => {
    const row = { tier: "focused", changes: 2, readHunks: 2, totalHunks: 8, readMinutes: 3 } as const;
    expect(attentionSummary(row)).toBe("Focused: a person read 2 of 8 hunks, about 3 min");
    expect(attentionSummary({ ...row, changes: 0 })).toBe("Focused: no changes");
  });
});

describe("escalation reasons", () => {
  it("counts changes per rule, most frequent first, never above the number of changes", () => {
    const { escalationReasons } = buildDashboardModel(sources, reportCard, {});
    expect(escalationReasons.length).toBeGreaterThan(0);
    for (let index = 1; index < escalationReasons.length; index++) {
      expect(escalationReasons[index - 1].changes).toBeGreaterThanOrEqual(escalationReasons[index].changes);
    }
    for (const reason of escalationReasons) {
      expect(reason.changes).toBeLessThanOrEqual(sources.length);
      expect(reason.label.length).toBeGreaterThan(0);
    }
  });

  it("re-routes after an escape: the area drops a level and its reason appears or grows", () => {
    const before = buildDashboardModel(sources, reportCard, {});
    const escapes = { generator: 1, analyzer: 1, security: 1, performance: 1 } as const;
    const after = buildDashboardModel(sources, reportCard, escapes);
    const areaChanges = (model: typeof before) => model.escalationReasons.find((reason) => reason.ruleId === "R-area-level")?.changes ?? 0;
    expect(areaChanges(after)).toBeGreaterThanOrEqual(areaChanges(before));
    expect(after.trust.every((area) => area.level === "shadow" || area.level === "calibrated")).toBe(true);
    // Shadow areas send every hunk to a person, so no hunk is read by evidence alone.
    expect(after.facts.readHunks).toBeGreaterThanOrEqual(before.facts.readHunks);
  });
});

describe("reviewer trust by area", () => {
  it("lists the four areas and treats a missing report card as Shadow everywhere", () => {
    const model = buildDashboardModel(sources, { state: "missing" }, {});
    expect(model.trust.map((area) => area.area)).toEqual(["generator", "analyzer", "security", "performance"]);
    expect(model.trust.every((area) => area.level === "shadow")).toBe(true);
  });

  it("drops the level of an area by one per escape", () => {
    const before = buildDashboardModel(sources, reportCard, {}).trust.find((area) => area.area === "generator");
    const after = buildDashboardModel(sources, reportCard, { generator: 1 }).trust.find((area) => area.area === "generator");
    if (before?.level === "shadow") expect(after?.level).toBe("shadow");
    else expect(after?.level).not.toBe(before?.level);
  });
});

describe("unrecorded changes", () => {
  it("counts a change without a review in the total but not in the hunks", () => {
    const unreviewed = withReview("mp-2234", (review) => review).map((source) =>
      source.change.id === "mp-2234" ? { ...source, review: { state: "missing" } as const } : source,
    );
    const model = buildDashboardModel(unreviewed, reportCard, {});
    expect(model.facts.changes).toBe(sources.length);
    expect(model.facts.totalHunks).toBeLessThan(buildDashboardModel(sources, reportCard, {}).facts.totalHunks);
  });
});
