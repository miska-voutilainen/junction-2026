import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { EscapeCounter } from "@/components/EscapeCounter";
import { InboxError } from "@/features/inbox";
import { ReceiptScreen } from "@/features/receipt-view";
import { FALLBACK_REPO, loadInboxData } from "@/lib/data/loadInboxSources";
import { loadChanges, loadReceipt } from "@/lib/data/loaders";

// Only the Tieto changes have a receipt page; any other id is a 404 at build time.
export const dynamicParams = false;

/** One static page per Tieto change in the recorded or fixture changes. */
export async function generateStaticParams(): Promise<{ id: string }[]> {
  const changes = await loadChanges();
  if (changes.status !== "ok") return [];
  return changes.data.filter((change) => change.kind === "tieto").map((change) => ({ id: change.id }));
}

/**
 * S4 · Full receipt. Reads every change (the shell routes them all) and this
 * change's receipt file on the server, then hands plain data to `ReceiptScreen`.
 * The inbox reader reports a bad receipt only as "unreadable", so the page
 * reads the file once more for its validation error.
 */
export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadInboxData();
  if (data.status === "invalid") {
    return (
      <AppShell
        changes={[]}
        repo={FALLBACK_REPO}
        title="Receipt"
        backHref="/"
        breadcrumb={[{ label: "Inbox", href: "/" }, { label: id }, { label: "Receipt" }]}
        escapeSlot={<EscapeCounter />}
      >
        <InboxError details={data.error} />
      </AppShell>
    );
  }
  if (!data.sources.some((source) => source.change.id === id)) notFound();

  const receipt = await loadReceipt(id);
  return (
    <ReceiptScreen
      changeId={id}
      sources={data.sources}
      reportCard={data.reportCard}
      repo={data.repo ?? FALLBACK_REPO}
      usesFixture={data.usesFixture}
      receiptError={receipt.status === "invalid" ? receipt.error : null}
    />
  );
}
