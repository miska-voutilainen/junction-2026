"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { EscapeCounter } from "@/components/EscapeCounter";
import { MockDataBanner } from "@/components/MockDataBanner";
import { takeRerouted, useEscapes } from "@/lib/simulation/escapes";
import { InboxView } from "./InboxView";
import { buildInboxModel, reportCardNotice, toShellChanges } from "./inboxModel";
import type { InboxSource, ReportCardInput } from "./inboxModel";

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
  const model = useMemo(() => buildInboxModel(sources, reportCard, escapes), [sources, reportCard, escapes]);
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
        <InboxView model={model} highlightedIds={highlightedIds} notice={reportCardNotice(reportCard)} />
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

/** How long the rows re-routed by the last escape stay highlighted; long enough to see after arriving from S3. */
const HIGHLIGHT_MS = 2400;

/**
 * Ids of the changes the last recorded escape re-routed, for a few seconds after
 * the inbox opens. They exist only after a client-side visit from S3, so the
 * first render never differs from the server's HTML (which has none).
 */
function useRecentlyRerouted(): ReadonlySet<string> {
  const [ids, setIds] = useState<ReadonlySet<string>>(() => new Set(takeRerouted()));
  useEffect(() => {
    if (ids.size === 0) return;
    const timer = setTimeout(() => setIds(new Set()), HIGHLIGHT_MS);
    return () => clearTimeout(timer);
  }, [ids]);
  return ids;
}
