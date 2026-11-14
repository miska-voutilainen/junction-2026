"use client";

import { useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { EscapeCounter } from "@/components/EscapeCounter";
import { MockDataBanner } from "@/components/MockDataBanner";
import { useEscapes } from "@/lib/simulation/escapes";
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
}: {
  sources: InboxSource[];
  reportCard: ReportCardInput;
  repo: string;
  usesFixture: boolean;
}) {
  const { escapes } = useEscapes();
  const model = useMemo(() => buildInboxModel(sources, reportCard, escapes), [sources, reportCard, escapes]);
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
        <InboxView model={model} notice={reportCardNotice(reportCard)} />
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
