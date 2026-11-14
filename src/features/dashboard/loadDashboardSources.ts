/**
 * Server-side reading for the dashboard: every change with its review and
 * receipt, plus the report card. Unlike the inbox, which shows an unreadable
 * file as one row's problem, the dashboard adds counts across all files, so a
 * file that fails validation fails the whole page (spec section 3, S5:
 * "never show partial counts as if complete"). Server-only: it reads `data/`.
 */
import type { InboxSource, ReportCardInput } from "@/features/inbox";
import { loadChanges, loadReceipt, loadReportCard, loadReview } from "@/lib/data/loaders";
import type { LoadResult } from "@/lib/data/loaders";

/** What the dashboard needs, or the validation errors that stop it. */
export type DashboardSources =
  | { status: "ok"; sources: InboxSource[]; reportCard: ReportCardInput; repo: string; usesFixture: boolean }
  | { status: "invalid"; errors: string[] };

const FALLBACK_REPO = "No repository";

/** Loads every file the dashboard counts; "invalid" lists each failing file's error, one per entry. */
export async function loadDashboardSources(): Promise<DashboardSources> {
  const changes = await loadChanges();
  if (changes.status === "invalid") return { status: "invalid", errors: [changes.error] };

  const changeInputs = changes.status === "ok" ? changes.data : [];
  const reportCard = await loadReportCard();
  const loaded = await Promise.all(
    changeInputs.map(async (change) => ({ change, review: await loadReview(change.id), receipt: await loadReceipt(change.id) })),
  );

  const results: LoadResult<unknown>[] = [changes, reportCard, ...loaded.flatMap(({ review, receipt }) => [review, receipt])];
  const errors = results.flatMap((result) => (result.status === "invalid" ? [result.error] : []));
  if (errors.length > 0) return { status: "invalid", errors };

  const sources: InboxSource[] = loaded.map(({ change, review, receipt }) => ({
    change,
    review: review.status === "ok" ? { state: "ok", data: review.data } : { state: "missing" },
    receipt: receipt.status === "ok" ? receipt.data : null,
  }));
  return {
    status: "ok",
    sources,
    reportCard: reportCard.status === "ok" ? { state: "ok", data: reportCard.data } : { state: "missing" },
    repo: changeInputs[0]?.repo ?? FALLBACK_REPO,
    usesFixture: results.some((result) => result.status === "ok" && result.source === "fixture"),
  };
}
