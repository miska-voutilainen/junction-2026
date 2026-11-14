// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { ReceiptRecord, Review } from "@/contracts";
import type { ReportCardInput } from "@/features/inbox";
import { loadReceipt, loadReportCard, loadReview } from "@/lib/data/loaders";
import { receiptStatus } from "@/lib/data/receiptStatus";
import { buildBlindCheck, buildRefusals, buildSignView, buildStepTabs, buildStory, citationLabel, formatSignedAt } from "./stepsModel";

const fixtureRoot = "data/fixtures";

async function loadFixtureReview(changeId: string): Promise<Review> {
  const review = await loadReview(changeId, fixtureRoot);
  if (review.status !== "ok") throw new Error(`fixture ${changeId} did not load`);
  return review.data;
}

async function loadFixtureReceipt(changeId: string): Promise<ReceiptRecord | null> {
  const receipt = await loadReceipt(changeId, fixtureRoot);
  return receipt.status === "ok" ? receipt.data : null;
}

async function readableCard(): Promise<ReportCardInput> {
  const reportCard = await loadReportCard(fixtureRoot);
  if (reportCard.status !== "ok") throw new Error("report card fixture did not load");
  return { state: "ok", data: reportCard.data };
}

describe("story", () => {
  it("groups claims by requirement item in the requirement's order, untraced claims last", async () => {
    const review = await loadFixtureReview("mp-2283");
    const headings = buildStory(review).groups.map((group) => group.heading.split(" · ")[0]);
    expect(headings).toEqual(["F1", "F2", "F3", "N1", "N2"]);

    const untraced = structuredClone(review);
    untraced.claims[0].requirementItemId = null;
    expect(buildStory(untraced).groups.at(-1)?.heading).toBe("Not traced to a requirement item");
  });

  it("pairs a retracted claim with its retraction and leaves the others alone", async () => {
    const claims = buildStory(await loadFixtureReview("mp-2283")).groups.flatMap((group) => group.claims);
    const retracted = claims.filter((entry) => entry.retraction !== null);
    expect(retracted.map((entry) => entry.claim.id)).toEqual(["c8"]);
    expect(claims.length).toBe(8);
  });

  it("never turns a quote-check failure into a claim", async () => {
    const review = await loadFixtureReview("mp-2283");
    const story = buildStory(review);
    expect(story.groups.flatMap((group) => group.claims).length).toBe(review.claims.length);
    expect(story.quoteCheckLine).toBe("Quote check: 9 of 10 quotes found in the code, 1 claim downgraded.");
  });
});

describe("blind check", () => {
  it("lists the contradictions with the sentence they contradict", async () => {
    const blindCheck = buildBlindCheck(await loadFixtureReview("mp-2283"), await readableCard());
    expect(blindCheck.contradictions).toHaveLength(1);
    expect(blindCheck.contradictions[0].finding.statement).toContain("diagnostics are unchanged");
  });

  it("shows this change's planted contradiction and the overall count from the report card", async () => {
    const blindCheck = buildBlindCheck(await loadFixtureReview("mp-2283"), await readableCard());
    expect(blindCheck.readingOrder.map((row) => [row.anchoredCaught, row.blindCaught, row.runs])).toEqual([[1, 3, 3]]);
    expect(blindCheck.overallLine).toBe(
      "Across 5 planted contradictions × 3 runs: given the description first caught 4 of 15 · blind-first caught 12 of 15",
    );
  });

  it("leaves out the reading-order count when the report card is missing", async () => {
    const blindCheck = buildBlindCheck(await loadFixtureReview("mp-2283"), { state: "missing" });
    expect(blindCheck.overallLine).toBeNull();
    expect(blindCheck.readingOrder).toEqual([]);
  });

  it("has nothing expected in anchored mode", async () => {
    const anchored = { ...(await loadFixtureReview("mp-2283")), expectation: null };
    expect(buildBlindCheck(anchored, { state: "missing" }).expected).toEqual([]);
  });
});

describe("refusals", () => {
  it("names each rule and its decider from the policy", async () => {
    const review = await loadFixtureReview("mp-2283");
    const { items } = buildRefusals(review, null, "needs-review");
    expect(items.map((item) => item.ruleId)).toEqual(["R6", "R7"]);
    expect(items[0].decider).toBe("change owner");
    expect(items[0].locations[0].label).toMatch(/:\d+/);
  });

  it("marks a refusal accepted only when a valid, current receipt accepts it", async () => {
    const review = await loadFixtureReview("mp-2283");
    const record = await loadFixtureReceipt("mp-2283");
    expect(receiptStatus(review, record)).toBe("signed");
    const accepted = buildRefusals(review, record, "signed").items.map((item) => item.acceptedBy);
    expect(accepted).toEqual([null, record?.receipt.owner]);

    // The same receipt on a changed diff vouches for nothing.
    const stale = buildRefusals(review, record, "stale").items.map((item) => item.acceptedBy);
    expect(stale).toEqual([null, null]);
  });

  it("keeps a refusal open when the receipt was signed against another run", async () => {
    const review = await loadFixtureReview("mp-2283");
    const record = await loadFixtureReceipt("mp-2283");
    if (record === null) throw new Error("fixture receipt missing");
    const otherRun = { ...record, receipt: { ...record.receipt, reviewRunId: "run-from-another-day" } };
    expect(buildRefusals(review, otherRun, "signed").items.map((item) => item.acceptedBy)).toEqual([null, null]);
    expect(buildStepTabs(review, otherRun, "signed")[2].count).toBe("2 open");
  });

  it("tells a fixed-rule refusal from one the AI raised", async () => {
    const { items } = buildRefusals(await loadFixtureReview("mp-2129"), null, "needs-review");
    expect(items.map((item) => [item.id, item.source])).toEqual([
      ["r1", "rule"],
      ["r2", "ai"],
    ]);
  });

  it("has no items when nothing was refused", async () => {
    expect(buildRefusals(await loadFixtureReview("mp-2234"), null, "needs-review").items).toEqual([]);
  });
});

describe("sign", () => {
  it("says the receipt file is unreadable instead of offering a draft", async () => {
    const review = await loadFixtureReview("mp-2234");
    expect(buildSignView(review, null, "unreadable").status).toBe("unreadable");
    expect(buildStepTabs(review, null, "unreadable")[3]).toMatchObject({ count: "Unreadable", tone: "rose" });
  });

  it("shows the draft and the sign command for a change with no receipt", async () => {
    const review = await loadFixtureReview("mp-2234");
    const view = buildSignView(review, null, "needs-review");
    expect(view.status).toBe("needs-review");
    expect(view.commands.sign).toBe("pnpm countersign sign mp-2234");
  });

  it("shows the verified receipt for a signed change", async () => {
    const review = await loadFixtureReview("mp-2283");
    const record = await loadFixtureReceipt("mp-2283");
    const view = buildSignView(review, record, receiptStatus(review, record));
    expect(view.status).toBe("signed");
  });

  it("carries both hashes for a stale receipt", async () => {
    const review = await loadFixtureReview("mp-2129");
    const record = await loadFixtureReceipt("mp-2129");
    const view = buildSignView(review, record, receiptStatus(review, record));
    if (view.status !== "stale") throw new Error(`expected stale, got ${view.status}`);
    expect(view.receipt.diffSha256).not.toBe(view.reviewDiffSha256);
    expect(view.reviewDiffSha256).toBe(review.diff.diffSha256);
  });

  it("reports a failed signature check as unverified, ahead of the diff comparison", async () => {
    const review = await loadFixtureReview("mp-2283");
    const record = await loadFixtureReceipt("mp-2283");
    if (record === null) throw new Error("fixture receipt missing");
    const failed = { ...record, verify: { ...record.verify, ok: false } };
    expect(buildSignView(review, failed, receiptStatus(review, failed)).status).toBe("unverified");
  });
});

describe("quote check", () => {
  it("marks a citation the quote check failed, and leaves the rest found", async () => {
    const review = structuredClone(await loadFixtureReview("mp-2283"));
    const failure = review.quoteCheck.failures[0];
    const claim = review.claims.find((candidate) => candidate.id === failure.itemId);
    if (!claim) throw new Error("fixture claim missing");
    const other = { ...failure.citation, startLine: 10, endLine: 11 };
    claim.citations = [failure.citation, other];

    const entry = buildStory(review)
      .groups.flatMap((group) => group.claims)
      .find((candidate) => candidate.claim.id === claim.id);
    expect(entry?.citations.map((citation) => citation.isQuoteFound)).toEqual([false, true]);
  });

  it("counts downgraded claims and dropped findings apart", async () => {
    const review = structuredClone(await loadFixtureReview("mp-2283"));
    review.quoteCheck = { ...review.quoteCheck, downgraded: 1, dropped: 2 };
    expect(buildStory(review).quoteCheckLine).toBe("Quote check: 9 of 10 quotes found in the code, 1 claim downgraded, 2 findings dropped.");
  });
});

describe("tabs", () => {
  it("counts what each step holds, and asks for attention on contradictions and a stale receipt", async () => {
    const review = await loadFixtureReview("mp-2283");
    const record = await loadFixtureReceipt("mp-2283");
    const tabs = buildStepTabs(review, record, "signed");
    expect(tabs.map((tab) => tab.label)).toEqual(["Read", "Blind check", "Refused", "Sign"]);
    expect(tabs.map((tab) => tab.count)).toEqual(["8 claims", "1 contradiction", "1 open", "Signed"]);
    expect(tabs[1].tone).toBe("rose");

    const staleReview = await loadFixtureReview("mp-2129");
    expect(buildStepTabs(staleReview, await loadFixtureReceipt("mp-2129"), "stale")[3]).toMatchObject({ count: "Stale", tone: "amber" });
  });
});

describe("labels", () => {
  it("writes a citation as file:line, collapsing a one-line range", () => {
    const citation = { file: "src/a/Foo.cs", side: "new" as const, startLine: 10, endLine: 12, quote: "" };
    expect(citationLabel(citation)).toBe("Foo.cs:10–12");
    expect(citationLabel({ ...citation, endLine: 10 })).toBe("Foo.cs:10");
  });

  it("formats the signing time in UTC", () => {
    expect(formatSignedAt("2026-11-13T17:22:48Z")).toBe("13 Nov 2026, 17:22 UTC");
  });
});
