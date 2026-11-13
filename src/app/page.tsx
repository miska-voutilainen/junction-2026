import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { EscapeCounter } from "@/components/EscapeCounter";
import { MockDataBanner } from "@/components/MockDataBanner";
import { InboxError, InboxView, buildInboxModel } from "@/features/inbox";
import type { InboxSource } from "@/features/inbox";
import { toShellChanges } from "@/features/inbox/inboxModel";
import { loadChanges, loadReceipt, loadReportCard, loadReview } from "@/lib/data/loaders";
import { levelsFromReportCard } from "@/rules/ladder";

const FALLBACK_REPO = "No repository";

/**
 * S1 · Inbox. Reads every change with its recorded review and receipt on the
 * server and hands plain data to `InboxView`, which routes it in the browser.
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
  const reportCard = await loadReportCard();
  const loaded = await Promise.all(
    changeInputs.map(async (change) => ({ change, review: await loadReview(change.id), receipt: await loadReceipt(change.id) })),
  );

  const sources: InboxSource[] = loaded.map(({ change, review, receipt }) => ({
    change,
    review:
      review.status === "ok"
        ? { state: "ok", data: review.data }
        : { state: review.status === "missing" ? "missing" : "unreadable" },
    receipt: receipt.status === "ok" ? receipt.data : null,
  }));
  const card = reportCard.status === "ok" ? reportCard.data : null;

  const usesFixture =
    (changes.status === "ok" && changes.source === "fixture") ||
    [reportCard, ...loaded.flatMap(({ review, receipt }) => [review, receipt])].some(
      (result) => result.status === "ok" && result.source === "fixture",
    );
  // Shell order and badge use the recorded trust levels; InboxView re-routes live with any escapes.
  const shellChanges = toShellChanges(buildInboxModel(sources, levelsFromReportCard(card)).rows);
  const hasAnyReview = sources.some((source) => source.review.state === "ok");

  return (
    <AppShell
      changes={shellChanges}
      repo={changeInputs[0]?.repo ?? FALLBACK_REPO}
      title="Inbox"
      breadcrumb={[{ label: "Inbox" }]}
      escapeSlot={<EscapeCounter />}
    >
      {usesFixture && <MockDataBanner />}
      {hasAnyReview ? (
        <InboxView sources={sources} reportCard={card} />
      ) : (
        <EmptyState
          title="No recorded reviews yet."
          body="Run this command to record one."
          command="pnpm pipeline run mp-2283"
        />
      )}
    </AppShell>
  );
}
