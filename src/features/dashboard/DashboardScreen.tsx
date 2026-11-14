"use client";

import Link from "next/link";
import { useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { EscapeCounter } from "@/components/EscapeCounter";
import { MockDataBanner } from "@/components/MockDataBanner";
import { buttonVariants } from "@/components/ui/button";
import { toShellChanges } from "@/features/inbox";
import type { InboxSource, ReportCardInput } from "@/features/inbox";
import { useEscapes } from "@/lib/simulation/escapes";
import { AcceptedRiskTable } from "./AcceptedRiskTable";
import { AttentionByTier } from "./AttentionByTier";
import { DashboardHeader } from "./DashboardHeader";
import { EscalationReasons } from "./EscalationReasons";
import { FactsStrip } from "./FactsStrip";
import { OpenDecisions } from "./OpenDecisions";
import { TrustByArea } from "./TrustByArea";
import { buildDashboardModel } from "./dashboardModel";

/**
 * The dashboard page inside its shell. Routing runs here with the current
 * simulated escapes, so the tier-dependent numbers (hunks read, attention by
 * tier, escalation reasons, trust) move when an escape is recorded.
 *
 * With no receipt the signing sections (facts, accepted risk) give way to an
 * empty state; attention and escalation need no receipt and stay.
 */
export function DashboardScreen({
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
  const model = useMemo(() => buildDashboardModel(sources, reportCard, escapes), [sources, reportCard, escapes]);
  const { facts } = model;

  return (
    <AppShell
      changes={toShellChanges(model.inbox.rows)}
      repo={repo}
      title="Dashboard"
      breadcrumb={[{ label: "Dashboard" }]}
      escapeSlot={<EscapeCounter />}
    >
      {usesFixture && <MockDataBanner />}
      <div className="mx-auto flex w-full max-w-content flex-col gap-6 px-4 py-6 compact:gap-8 compact:px-8 compact:py-7">
        <DashboardHeader reviewNext={model.inbox.reviewNext} />
        {model.hasReceipts ? (
          <>
            <p className="text-sm text-text-secondary compact:hidden">
              {facts.signed} of {facts.changes} changes signed · {facts.readHunks} of {facts.totalHunks} hunks read by a person
            </p>
            <FactsStrip
              facts={facts}
              className="hidden grid-cols-5 gap-px overflow-hidden rounded-page border border-border-subtle bg-border-subtle compact:grid"
            />
          </>
        ) : (
          <EmptyState
            title="No signed changes yet."
            body="Numbers appear once someone signs a receipt."
            actions={
              <Link href="/" className={buttonVariants({ variant: "secondary" })}>
                Open the inbox
              </Link>
            }
            className="w-full max-w-none rounded-page border border-dashed border-border-default py-10"
          />
        )}
        <div className="grid gap-6 compact:grid-cols-2 compact:gap-x-8 compact:gap-y-8">
          <OpenDecisions queues={model.deciderQueues} />
          {model.hasReceipts && (
            <div className="compact:order-first compact:col-span-2">
              <AcceptedRiskTable risks={model.acceptedRisks} />
            </div>
          )}
          <AttentionByTier rows={model.attention} />
        </div>
        <div className="hidden flex-col gap-2 compact:flex">
          <EscalationReasons reasons={model.escalationReasons} changes={facts.reviewedChanges} />
          <TrustByArea trust={model.trust} reportCard={reportCard} />
        </div>
      </div>
    </AppShell>
  );
}
