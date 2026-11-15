import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import { EscapeCounter } from "@/components/EscapeCounter";
import { InboxError, InboxScreen } from "@/features/inbox";
import { FALLBACK_REPO, loadInboxData } from "@/lib/data/loadInboxSources";

export const metadata: Metadata = { title: "Inbox · Countersign" };

/**
 * S1 · Inbox. Reads every change with its recorded review and receipt on the
 * server and hands plain data to `InboxScreen`, which routes it in the browser.
 * A source of "fixture" anywhere turns on the mock-data banner.
 */
export default async function InboxPage() {
  const data = await loadInboxData();
  if (data.status === "invalid") {
    return (
      <AppShell
        changes={[]}
        repo={FALLBACK_REPO}
        title="Inbox"
        breadcrumb={[{ label: "Inbox" }]}
        escapeSlot={<EscapeCounter />}
      >
        <InboxError details={data.error} />
      </AppShell>
    );
  }

  return (
    <InboxScreen
      sources={data.sources}
      reportCard={data.reportCard}
      repo={data.repo ?? FALLBACK_REPO}
      usesFixture={data.usesFixture}
    />
  );
}
