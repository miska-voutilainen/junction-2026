"use client";

import { useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { EscapeCounter } from "@/components/EscapeCounter";
import { LevelLadder } from "@/components/LevelLadder";
import { MockDataBanner } from "@/components/MockDataBanner";
import { buildInboxModel, inboxLevels, toShellChanges } from "@/features/inbox";
import type { InboxSource } from "@/features/inbox";
import { useEscapes } from "@/lib/simulation/escapes";
import { BlindFirstSection } from "./BlindFirstSection";
import { LevelsLegend } from "./LevelsLegend";
import { ReportLists } from "./ReportLists";
import { ReviewerHeader } from "./ReviewerHeader";
import { RoutingSpread } from "./RoutingSpread";
import { TrustLadderSection } from "./TrustLadderSection";
import { areaCardModels, measuredLine } from "./reportCardModel";
import type { ReviewOfChange } from "./reportCardModel";
import type { ReportCard } from "@/contracts";

const LESSONS_LOG_URL = "https://github.com/miska-voutilainen/junction-2026/blob/main/docs/lessons.md";

/** The report card as the server found it; "unreadable" carries the validation error. */
export type ReportCardSource = { state: "ok"; data: ReportCard } | { state: "missing" } | { state: "unreadable"; error: string };

/**
 * S3 inside its shell. Routing runs here with the current simulated escapes and
 * feeds the shell too, so recording an escape on a card moves the cards, the
 * routing spread and the nav badge together (`inboxModel.ts` is the one place
 * tiers are computed). Spec section 3, S3.
 */
export function ReviewerScreen({
  sources,
  reportCard,
  repo,
  usesFixture,
}: {
  sources: InboxSource[];
  reportCard: ReportCardSource;
  repo: string;
  usesFixture: boolean;
}) {
  const { escapes, total } = useEscapes();
  const model = useMemo(() => buildInboxModel(sources, inboxLevels(reportCard, escapes)), [sources, reportCard, escapes]);
  const data = reportCard.state === "ok" ? reportCard.data : null;
  const cards = useMemo(() => areaCardModels(data, escapes), [data, escapes]);
  const reviews = useMemo<ReviewOfChange[]>(
    () => sources.flatMap(({ change, review }) => (review.state === "ok" ? [{ changeId: change.id, review: review.data }] : [])),
    [sources],
  );

  return (
    <AppShell
      changes={toShellChanges(model.rows)}
      repo={repo}
      title="Reviewer report card"
      breadcrumb={[{ label: "Inbox", href: "/" }, { label: "Reviewer report card" }]}
      backHref="/"
      escapeSlot={<EscapeCounter />}
    >
      {usesFixture && <MockDataBanner />}
      <div className="mx-auto flex w-full max-w-content flex-col gap-6 px-4 py-6 compact:px-8 compact:py-7">
        <ReviewerHeader measured={data ? measuredLine(data) : null} />
        {reportCard.state === "missing" && <NoEvaluation />}
        {reportCard.state === "unreadable" && <UnreadableReportCard error={reportCard.error} />}
        {data && (
          <>
            <LevelsLegend />
            <TrustLadderSection cards={cards} />
            <ReportLists reportCard={data} reviews={reviews} />
            <BlindFirstSection reportCard={data} />
            <RoutingSpread summary={model.summary} escapeCount={total} />
          </>
        )}
        <a href={LESSONS_LOG_URL} target="_blank" rel="noopener" className="self-start text-sm text-link hover:underline">
          Lessons log
        </a>
      </div>
    </AppShell>
  );
}

function NoEvaluation() {
  return (
    <EmptyState
      title="No evaluation recorded yet."
      body="Every area is at Shadow: the reviewer has no track record, so its view can't lower any tier. Run this command to measure the reviewer."
      command="pnpm evals"
      actions={<LevelLadder level="shadow" />}
    />
  );
}

function UnreadableReportCard({ error }: { error: string }) {
  return (
    <ErrorState
      title="The report card couldn't be read."
      body="Re-run pnpm evals. Until it reads, every area is treated as Shadow and changes route as if the reviewer had no track record."
      details={error}
    />
  );
}
