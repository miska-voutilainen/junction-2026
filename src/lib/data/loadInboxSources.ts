import type { InboxSource } from "@/features/inbox";
import { loadChanges, loadReceipt, loadReportCard, loadReview } from "./loaders";
import type { ReportCardInput } from "@/lib/decideChange";

/** Repository label when no change is recorded. */
export const FALLBACK_REPO = "No repository";

/** Every change with its review and receipt, plus the report card, as the inbox and the report card page read them. */
export type InboxData =
  | { status: "invalid"; error: string }
  | { status: "ok"; sources: InboxSource[]; reportCard: ReportCardInput; repo: string | null;
      usesFixture: boolean;
      /** The validation error of every file that failed, one entry each; empty when all files read. */
      problems: string[];
    };

/**
 * Reads the four changes, each review and receipt, and the report card, and
 * says whether any of it came from `data/fixtures/` (the mock-data banner).
 * Shared by `/`, `/reviewer` and `/dashboard`, which route the same sources in the browser.
 *
 * @param root data folder to read; defaults to the repository's `data/` (tests pass the fixtures)
 */
export async function loadInboxData(root?: string): Promise<InboxData> {
  const changes = await loadChanges(root);
  if (changes.status === "invalid") return { status: "invalid", error: changes.error };

  const changeInputs = changes.status === "ok" ? changes.data : [];
  const reportCardResult = await loadReportCard(root);
  const loaded = await Promise.all(
    changeInputs.map(async (change) => ({ change, review: await loadReview(change.id, root), receipt: await loadReceipt(change.id, root) })),
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
      ? { state: "ok", data: reportCardResult.data, source: reportCardResult.source }
      : reportCardResult.status === "missing"
        ? { state: "missing" }
        : { state: "unreadable", error: reportCardResult.error };

  const usesFixture =
    (changes.status === "ok" && changes.source === "fixture") ||
    [reportCardResult, ...loaded.flatMap(({ review, receipt }) => [review, receipt])].some(
      (result) => result.status === "ok" && result.source === "fixture",
    );

  const problems = [reportCardResult, ...loaded.flatMap(({ review, receipt }) => [review, receipt])].flatMap((result) =>
    result.status === "invalid" ? [result.error] : [],
  );

  return { status: "ok", sources, reportCard, repo: changeInputs[0]?.repo ?? null, usesFixture, problems };
}
