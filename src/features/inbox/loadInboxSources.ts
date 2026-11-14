/**
 * Server-only: reads every change with its recorded review and receipt, and
 * the report card, in the shape `buildInboxModel` takes. The inbox page and
 * the review page both need the whole list (the shell's nav badge and command
 * menu show every change), so the reading lives here once. Import it from
 * server components by path, not through `index.ts`, which client code uses.
 */
import { loadChanges, loadReceipt, loadReportCard, loadReview } from "@/lib/data/loaders";
import type { InboxSource, ReportCardInput } from "./inboxModel";

/** Everything the inbox and review pages read from `data/`. */
export type InboxSources =
  | { status: "invalid"; error: string }
  | {
      status: "ok";
      sources: InboxSource[];
      reportCard: ReportCardInput;
      /** Why a change's review is unreadable, by change id. */
      reviewErrors: Record<string, string>;
      /** True when any file came from `data/fixtures/`, which turns on the mock-data banner. */
      usesFixture: boolean;
    };

/** Loads all Tieto changes with their review and receipt, plus the report card. */
export async function loadInboxSources(): Promise<InboxSources> {
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
      : { state: reportCardResult.status === "missing" ? "missing" : "unreadable" };
  const reviewErrors = Object.fromEntries(
    loaded.flatMap(({ change, review }) => (review.status === "invalid" ? [[change.id, review.error]] : [])),
  );
  const usesFixture =
    (changes.status === "ok" && changes.source === "fixture") ||
    [reportCardResult, ...loaded.flatMap(({ review, receipt }) => [review, receipt])].some(
      (result) => result.status === "ok" && result.source === "fixture",
    );

  return { status: "ok", sources, reportCard, reviewErrors, usesFixture };
}
