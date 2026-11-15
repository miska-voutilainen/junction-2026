"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { EscapeCounter } from "@/components/EscapeCounter";
import { MockDataBanner } from "@/components/MockDataBanner";
import { toShellChanges } from "@/components/shellChange";
import { reportCardNotice } from "@/lib/decideChange";
import type { ReportCardInput } from "@/lib/decideChange";
import { clearRerouted, peekRerouted, useEscapes } from "@/lib/simulation/escapes";
import { InboxView } from "./InboxView";
import { buildInboxModel } from "./inboxModel";
import type { InboxSource } from "./inboxModel";

/**
 * The inbox page inside its shell. Routing runs here, once, with the current
 * simulated escapes, and feeds both the list and the shell (nav badge, N
 * shortcut, command menu order), so an escape re-routes all of them together
 * and "inbox order" has one source (`inboxModel.ts`).
 */
export function InboxScreen({
  sources,
  reportCard,
  repo,
  usesFixture,
}: Readonly<{
  sources: InboxSource[];
  reportCard: ReportCardInput;
  repo: string;
  usesFixture: boolean;
}>) {
  const { escapes } = useEscapes();
  const model = useMemo(
    () => buildInboxModel(sources, reportCard, escapes),
    [sources, reportCard, escapes],
  );
  const highlightedIds = useRecentlyRerouted();
  const hasAnyReview = sources.some((source) => source.review.state === "ok");

  return (
    <AppShell
      changes={toShellChanges(model.rows)}
      repo={repo}
      title="Inbox"
      breadcrumb={[{ label: "Inbox" }]}
      escapeSlot={<EscapeCounter />}
    >
      {usesFixture && <MockDataBanner />}
      {hasAnyReview ? (
        <InboxView
          model={model}
          highlightedIds={highlightedIds}
          notice={reportCardNotice(reportCard)}
        />
      ) : (
        <EmptyState
          title="No recorded reviews yet."
          body="Run this command to record one."
          command="pnpm review run mp-2283"
        />
      )}
    </AppShell>
  );
}

/**
 * Ids of the changes the last recorded escape re-routed, highlighted for this
 * visit to the inbox. No timer: a re-routed row can sit in the folded Signed
 * list, and a highlight that fades after a few seconds would be gone before the
 * reviewer opens the fold. They exist only after a client-side visit from S3,
 * so the first render never differs from the server's HTML (which has none).
 */
function useRecentlyRerouted(): ReadonlySet<string> {
  // Read in the initializer, cleared after mount: a render React discards must not
  // use up the ids, and StrictMode's second effect run only clears an empty list.
  const [ids] = useState<ReadonlySet<string>>(() => new Set(peekRerouted()));
  useEffect(() => clearRerouted(), []);
  return ids;
}
