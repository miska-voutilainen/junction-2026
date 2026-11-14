// @vitest-environment node
import { cp, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { InboxSource, ReportCardInput } from "@/features/inbox";
import { attentionSummary, buildDashboardModel, reasonLabel } from "./dashboardModel";
import { loadDashboardSources } from "./loadDashboardSources";

// Pinned to the committed fixtures, so recorded data landing under data/ cannot change these counts.
// They stand in for recorded data: four Tieto changes, mp-2283 signed, mp-2129 amended after signing.
const fixtureRoot = "data/fixtures";

let sources: InboxSource[];
let reportCard: ReportCardInput;

beforeAll(async () => {
  const loaded = await loadDashboardSources(fixtureRoot);
  if (loaded.status !== "ok") throw new Error(`fixtures are invalid: ${loaded.errors.join("; ")}`);
  sources = loaded.sources;
  reportCard = loaded.reportCard;
});

/** The sources with one change's receipt marked as failing its signature check. */
function withFailedCheck(id: string): InboxSource[] {
  return sources.map((source) =>
    source.change.id === id && source.receipt !== null && source.receipt !== "unreadable"
      ? { ...source, receipt: { ...source.receipt, verify: { ...source.receipt.verify, ok: false } } }
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
    expect(acceptedRisks.map((risk) => [risk.changeId, risk.status])).toEqual([
      ["mp-2129", "stale"],
      ["mp-2283", "signed"],
    ]);
    expect(acceptedRisks[1].text.length).toBeGreaterThan(0);
  });

  it("keeps a receipt whose check failed out of Signed, lists it first and leaves its refusals open", () => {
    const failed = buildDashboardModel(withFailedCheck("mp-2283"), reportCard, {});
    const normal = buildDashboardModel(sources, reportCard, {});
    expect(failed.facts.signed).toBe(0);
    expect(failed.acceptedRisks[0]).toMatchObject({ changeId: "mp-2283", status: "unverified" });
    const open = (queues: typeof normal.deciderQueues) => queues.reduce((sum, queue) => sum + queue.count, 0);
    expect(open(failed.deciderQueues)).toBeGreaterThan(open(normal.deciderQueues));
  });

  it("counts a stale-only set of receipts as receipts, so the rows still show", () => {
    const staleOnly = sources.map((source) => (source.change.id === "mp-2283" ? { ...source, receipt: null } : source));
    const model = buildDashboardModel(staleOnly, reportCard, {});
    expect(model.hasReceipts).toBe(true);
    expect(model.facts.signed).toBe(0);
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

describe("reasonLabel", () => {
  it("names the routing rules it knows", () => {
    expect(reasonLabel("R-area-level", "Security: Shadow, the AI's output routes nothing here")).toBe("Area not yet Trusted");
  });

  it("falls back to the sentence route() gave for a rule it has no label for", () => {
    expect(reasonLabel("R-new-rule", "2 files use a new thing")).toBe("2 files use a new thing");
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
  it("counts a change without a review in the total but not in the hunks, and says how many were reviewed", () => {
    const unreviewed = sources.map((source) =>
      source.change.id === "mp-2234" ? { ...source, review: { state: "missing" } as const } : source,
    );
    const model = buildDashboardModel(unreviewed, reportCard, {});
    expect(model.facts.changes).toBe(sources.length);
    expect(model.facts.reviewedChanges).toBe(sources.length - 1);
    expect(model.facts.totalHunks).toBeLessThan(buildDashboardModel(sources, reportCard, {}).facts.totalHunks);
  });
});

describe("loadDashboardSources", () => {
  let root: string;

  beforeAll(async () => {
    root = await mkdtemp(path.join(tmpdir(), "countersign-dashboard-"));
    await cp(fixtureRoot, root, { recursive: true });
    await writeFile(path.join(root, "receipts", "mp-2283.json"), '{"changeId": 7}');
  });

  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("fails as a whole, naming the file, when one data file is invalid, so no partial counts show", async () => {
    const loaded = await loadDashboardSources(root);
    expect(loaded.status).toBe("invalid");
    if (loaded.status !== "invalid") return;
    expect(loaded.errors).toHaveLength(1);
    expect(loaded.errors[0]).toContain("mp-2283.json");
  });

  it("loads every change, review and receipt from a valid data folder", async () => {
    const loaded = await loadDashboardSources(fixtureRoot);
    expect(loaded.status === "ok" && loaded.sources).toHaveLength(4);
  });
});
