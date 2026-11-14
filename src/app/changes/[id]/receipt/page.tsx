import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { EscapeCounter } from "@/components/EscapeCounter";
import { InboxError } from "@/features/inbox";
import { ReceiptScreen } from "@/features/receipt-view";
import { FALLBACK_REPO, loadInboxData } from "@/lib/data/loadInboxSources";
import { loadChanges, loadReceipt, loadReceiptText } from "@/lib/data/loaders";

// No `dynamicParams = false`: it would answer an unknown id with Next's unstyled 404 instead of the not-found.tsx with the shell.

/** One static page per Tieto change; any other id falls through to the change segment's not-found page. */
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
  const receiptText = await loadReceiptText(id);
  return (
    <ReceiptScreen
      changeId={id}
      sources={data.sources}
      reportCard={data.reportCard}
      repo={data.repo ?? FALLBACK_REPO}
      usesFixture={data.usesFixture}
      receiptError={receipt.status === "invalid" ? receipt.error : null}
      receiptText={receiptText}
    />
  );
}
