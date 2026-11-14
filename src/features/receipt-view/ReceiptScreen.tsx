"use client";

import { useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { EscapeCounter } from "@/components/EscapeCounter";
import { MockDataBanner } from "@/components/MockDataBanner";
import { buildInboxModel, inboxLevels, toShellChanges } from "@/features/inbox";
import type { InboxSource, ReportCardInput } from "@/features/inbox";
import { useEscapes } from "@/lib/simulation/escapes";
import { ReceiptDocument } from "./ReceiptDocument";
import { InvalidReceipt, NoReceipt } from "./ReceiptStates";
import { buildReceiptView } from "./receiptModel";

/**
 * The receipt page inside its shell. The shell gets the same live routing as
 * the inbox (nav badge, command menu order, simulated escapes); the receipt
 * itself does not depend on routing, so only the shell reads the escapes.
 *
 * @param changeId The change whose receipt to show; it must be one of `sources`.
 * @param receiptError Why the receipt file failed validation, when it did.
 */
export function ReceiptScreen({
  changeId,
  sources,
  reportCard,
  repo,
  usesFixture,
  receiptError,
}: {
  changeId: string;
  sources: InboxSource[];
  reportCard: ReportCardInput;
  repo: string;
  usesFixture: boolean;
  receiptError: string | null;
}) {
  const { escapes } = useEscapes();
  const model = useMemo(() => buildInboxModel(sources, inboxLevels(reportCard, escapes)), [sources, reportCard, escapes]);
  const source = sources.find((candidate) => candidate.change.id === changeId);
  const view = useMemo(() => (source ? buildReceiptView(source, receiptError) : null), [source, receiptError]);

  return (
    <AppShell
      changes={toShellChanges(model.rows)}
      repo={repo}
      title="Receipt"
      backHref={`/changes/${changeId}`}
      breadcrumb={[{ label: "Inbox", href: "/" }, { label: changeId, href: `/changes/${changeId}` }, { label: "Receipt" }]}
      escapeSlot={<EscapeCounter />}
    >
      {usesFixture && <MockDataBanner />}
      <div className="mx-auto w-full max-w-prose px-4 py-6 compact:px-7 compact:py-10">
        {view?.kind === "document" && <ReceiptDocument view={view} />}
        {view?.kind === "none" && <NoReceipt changeId={view.changeId} signCommand={view.signCommand} />}
        {view?.kind === "invalid" && <InvalidReceipt changeId={view.changeId} error={view.error} />}
      </div>
    </AppShell>
  );
}
