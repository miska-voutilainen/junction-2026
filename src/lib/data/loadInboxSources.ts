import type { InboxSource, ReportCardInput } from "@/features/inbox";
import { loadChanges, loadReceipt, loadReportCard, loadReview } from "./loaders";

/** Every change with its review and receipt, plus the report card, as the inbox and the report card page read them. */
export type InboxData =
  | { status: "invalid"; error: string }
  | { status: "ok"; sources: InboxSource[]; reportCard: ReportCardInput; repo: string | null; usesFixture: boolean };

/**
 * Reads the four changes, each review and receipt, and the report card, and
 * says whether any of it came from `data/fixtures/` (the mock-data banner).
 * Shared by `/` and `/reviewer`, which route the same sources in the browser.
 */
export async function loadInboxData(): Promise<InboxData> {
  const changes = await loadChanges();
  if (changes.status === "invalid") return { status: "invalid", error: changes.error };

  const changeInputs = changes.status === "ok" ? changes.data : [];
  const reportCardResult = await loadReportCard();
  const loaded = await Promise.all(
    changeInputs.map(async (change) => ({ change, review: await loadReview(change.id), receipt: await loadReceipt(change.id) })),
  );

  const sources: InboxSource[] = loaded.map(({ change, review, receipt }) => ({
    change,
    review:
      review.status === "ok"
        ? { state: "ok", data: review.data }
        : { state: review.status === "missing" ? "missing" : "unreadable" },
    receipt: receipt.status === "ok" ? receipt.data : receipt.status === "invalid" ? "unreadable" : null,
  }));
  const reportCard: ReportCardInput =
    reportCardResult.status === "ok"
      ? { state: "ok", data: reportCardResult.data }
      : reportCardResult.status === "missing"
        ? { state: "missing" }
        : { state: "unreadable", error: reportCardResult.error };

  const usesFixture =
    (changes.status === "ok" && changes.source === "fixture") ||
    [reportCardResult, ...loaded.flatMap(({ review, receipt }) => [review, receipt])].some(
      (result) => result.status === "ok" && result.source === "fixture",
    );

  return { status: "ok", sources, reportCard, repo: changeInputs[0]?.repo ?? null, usesFixture };
}
