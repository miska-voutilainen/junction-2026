import { beforeAll, describe, expect, it } from "vitest";
import type { ReceiptRecord, Review } from "@/contracts";
import { loadReceipt, loadReportCard, loadReview } from "@/lib/data/loaders";
import { decideChange } from "./decideChange";
import type { ReportCardInput } from "./decideChange";
import { receiptUnderEscapes } from "./receiptUnderEscapes";

// Pinned to the committed fixtures: mp-2283 is signed, mp-2129 has a stale receipt.
const fixtureRoot = "data/fixtures";

let card: ReportCardInput;
let review: Review;
let record: ReceiptRecord;

beforeAll(async () => {
  const reportCard = await loadReportCard(fixtureRoot);
  const loadedReview = await loadReview("mp-2283", fixtureRoot);
  const loadedReceipt = await loadReceipt("mp-2283", fixtureRoot);
  if (reportCard.status !== "ok" || loadedReview.status !== "ok" || loadedReceipt.status !== "ok") {
    throw new Error("fixtures are missing");
  }
  card = { state: "ok", data: reportCard.data, source: "fixture" };
  review = loadedReview.data;
  record = loadedReceipt.data;
});

function stateUnder(escapes: Parameters<typeof decideChange>[2], edit: (record: ReceiptRecord) => ReceiptRecord = (r) => r) {
  const { decision } = decideChange(review, card, escapes);
  return receiptUnderEscapes(review, edit(record), decision, escapes);
}

describe("receiptUnderEscapes", () => {
  it("stays signed with no escapes", () => {
    expect(stateUnder({})).toEqual({ status: "signed", reopenedHunkIds: [], escapedAreas: [] });
  });

  it("reopens a signed receipt when a Generator escape sends hunks the signer did not read to a person", () => {
    const result = stateUnder({ generator: 1 });
    expect(result.status).toBe("reopened");
    expect(result.escapedAreas).toEqual(["generator"]);
    expect(result.reopenedHunkIds.length).toBeGreaterThan(0);
  });

  it("does not reopen when the escape is in an area the change does not touch", () => {
    expect(stateUnder({ performance: 1 }).status).toBe("signed");
  });

  it("never overrides a stale receipt", () => {
    const stale = (r: ReceiptRecord): ReceiptRecord => ({ ...r, receipt: { ...r.receipt, diffSha256: "0".repeat(64) } });
    expect(stateUnder({ generator: 1 }, stale).status).toBe("stale");
  });

  it("never overrides a failed verification", () => {
    const failed = (r: ReceiptRecord): ReceiptRecord => ({ ...r, verify: { ...r.verify, ok: false } });
    expect(stateUnder({ generator: 1 }, failed).status).toBe("unverified");
  });

  it("reports needs-review for a change with no receipt", () => {
    const { decision } = decideChange(review, card, { generator: 1 });
    expect(receiptUnderEscapes(review, null, decision, { generator: 1 }).status).toBe("needs-review");
  });
});
