import { AppShell } from "@/components/AppShell";
import { EscapeCounter } from "@/components/EscapeCounter";
import { InboxError, InboxScreen } from "@/features/inbox";
import type { InboxSource, ReportCardInput } from "@/features/inbox";
import { loadChanges, loadReceipt, loadReportCard, loadReview } from "@/lib/data/loaders";

const FALLBACK_REPO = "No repository";

/**
 * S1 · Inbox. Reads every change with its recorded review and receipt on the
 * server and hands plain data to `InboxScreen`, which routes it in the browser.
 * A source of "fixture" anywhere turns on the mock-data banner.
 */
export default async function InboxPage() {
  const changes = await loadChanges();
  if (changes.status === "invalid") {
    return (
      <AppShell changes={[]} repo={FALLBACK_REPO} title="Inbox" breadcrumb={[{ label: "Inbox" }]} escapeSlot={<EscapeCounter />}>
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
  const reportCard: ReportCardInput =
    reportCardResult.status === "ok"
      ? { state: "ok", data: reportCardResult.data }
      : { state: reportCardResult.status === "missing" ? "missing" : "unreadable" };

  const usesFixture =
    (changes.status === "ok" && changes.source === "fixture") ||
    [reportCardResult, ...loaded.flatMap(({ review, receipt }) => [review, receipt])].some(
      (result) => result.status === "ok" && result.source === "fixture",
    );

  return (
    <InboxScreen
      sources={sources}
      reportCard={reportCard}
      repo={changeInputs[0]?.repo ?? FALLBACK_REPO}
      usesFixture={usesFixture}
    />
  );
}
