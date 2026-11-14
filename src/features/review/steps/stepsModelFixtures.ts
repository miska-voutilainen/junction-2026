// The fixture data the step model tests share: a review, its receipt and the report card, read from data/fixtures.
import type { ReceiptRecord, Review } from "@/contracts";
import type { ReportCardInput } from "@/lib/decideChange";
import { loadReceipt, loadReportCard, loadReview } from "@/lib/data/loaders";

const fixtureRoot = "data/fixtures";

export async function loadFixtureReview(changeId: string): Promise<Review> {
  const review = await loadReview(changeId, fixtureRoot);
  if (review.status !== "ok") throw new Error(`fixture ${changeId} did not load`);
  return review.data;
}

export async function loadFixtureReceipt(changeId: string): Promise<ReceiptRecord | null> {
  const receipt = await loadReceipt(changeId, fixtureRoot);
  return receipt.status === "ok" ? receipt.data : null;
}

export async function readableCard(): Promise<ReportCardInput> {
  const reportCard = await loadReportCard(fixtureRoot);
  if (reportCard.status !== "ok") throw new Error("report card fixture did not load");
  return { state: "ok", data: reportCard.data, source: reportCard.source };
}
