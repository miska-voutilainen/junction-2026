import { AppShell } from "@/components/AppShell";
import { EscapeCounter } from "@/components/EscapeCounter";
import { ReviewerScreen } from "@/features/report-card";
import type { ReportCardSource } from "@/features/report-card";
import { InboxError } from "@/features/inbox";
import type { InboxSource } from "@/features/inbox";
import { loadChanges, loadReceipt, loadReportCard, loadReview } from "@/lib/data/loaders";

const FALLBACK_REPO = "No repository";

/**
 * S3 · Reviewer report card. Reads the report card and, for the routing spread
 * and the lists, every change with its review and receipt, then hands plain
 * data to `ReviewerScreen`, which re-levels in the browser with the simulated
 * escapes. A source of "fixture" anywhere turns on the mock-data banner.
 */
export default async function ReviewerPage() {
  const changes = await loadChanges();
  if (changes.status === "invalid") {
    return (
      <AppShell
        changes={[]}
        repo={FALLBACK_REPO}
        title="Reviewer report card"
        breadcrumb={[{ label: "Inbox", href: "/" }, { label: "Reviewer report card" }]}
        backHref="/"
        escapeSlot={<EscapeCounter />}
      >
        <InboxError details={changes.error} />
      </AppShell>
    );
  }

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
  const reportCard: ReportCardSource =
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

  return (
    <ReviewerScreen sources={sources} reportCard={reportCard} repo={changeInputs[0]?.repo ?? FALLBACK_REPO} usesFixture={usesFixture} />
  );
}
