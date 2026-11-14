import { AppShell } from "@/components/AppShell";
import { EscapeCounter } from "@/components/EscapeCounter";
import { InboxError, InboxScreen } from "@/features/inbox";
import { loadInboxSources } from "@/features/inbox/loadInboxSources";

const FALLBACK_REPO = "No repository";

/**
 * S1 · Inbox. Reads every change with its recorded review and receipt on the
 * server and hands plain data to `InboxScreen`, which routes it in the browser.
 * A source of "fixture" anywhere turns on the mock-data banner.
 */
export default async function InboxPage() {
  const inbox = await loadInboxSources();
  if (inbox.status === "invalid") {
    return (
      <AppShell changes={[]} repo={FALLBACK_REPO} title="Inbox" breadcrumb={[{ label: "Inbox" }]} escapeSlot={<EscapeCounter />}>
        <InboxError details={inbox.error} />
      </AppShell>
    );
  }

  return (
    <InboxScreen
      sources={inbox.sources}
      reportCard={inbox.reportCard}
      repo={inbox.sources[0]?.change.repo ?? FALLBACK_REPO}
      usesFixture={inbox.usesFixture}
    />
  );
}
