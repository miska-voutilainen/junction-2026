"use client";

import { useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { EscapeCounter } from "@/components/EscapeCounter";
import { LevelLadder } from "@/components/LevelLadder";
import { MockDataBanner } from "@/components/MockDataBanner";
import { buildInboxModel, toShellChanges } from "@/features/inbox";
import type { InboxSource, ReportCardInput } from "@/features/inbox";
import { REPO_BLOB_URL } from "@/lib/ideaLinks";
import { useEscapes } from "@/lib/simulation/escapes";
import { BlindFirstSection } from "./BlindFirstSection";
import { LevelsLegend } from "./LevelsLegend";
import { ReportLists } from "./ReportLists";
import { ReviewerHeader } from "./ReviewerHeader";
import { RoutingSpread } from "./RoutingSpread";
import { TrustLadderSection } from "./TrustLadderSection";
import { areaCardModels, measuredLine } from "./reportCardModel";
import type { ReviewOfChange } from "./reportCardModel";

const LESSONS_LOG_URL = `${REPO_BLOB_URL}/docs/lessons.md`;

/**
 * S3 inside its shell. Routing runs here with the current simulated escapes and
 * feeds the shell too, so recording an escape on a card moves the cards, the
 * routing spread and the nav badge together (`inboxModel.ts` is the one place
 * tiers are computed). Spec section 3, S3.
 *
 * @param hasLessonsLog Whether `docs/lessons.md` exists; the footer link shows only then.
 */
export function ReviewerScreen({
  sources,
  reportCard,
  repo,
  usesFixture,
  hasLessonsLog,
}: Readonly<{
  sources: InboxSource[];
  reportCard: ReportCardInput;
  repo: string;
  usesFixture: boolean;
  hasLessonsLog: boolean;
}>) {
  const { escapes, total, record, undo } = useEscapes();
  const model = useMemo(
    () => buildInboxModel(sources, reportCard, escapes),
    [sources, reportCard, escapes],
  );
  const data = reportCard.state === "ok" ? reportCard.data : null;
  const cards = useMemo(() => areaCardModels(data, escapes), [data, escapes]);
  const reviews = useMemo<ReviewOfChange[]>(
    () =>
      sources.flatMap(({ change, review }) =>
        review.state === "ok" ? [{ changeId: change.id, review: review.data }] : [],
      ),
    [sources],
  );

  return (
    <AppShell
      changes={toShellChanges(model.rows)}
      repo={repo}
      title="Reviewer Report Card"
      breadcrumb={[{ label: "Inbox", href: "/" }, { label: "Reviewer Report Card" }]}
      backHref="/"
      escapeSlot={<EscapeCounter />}
    >
      {usesFixture && <MockDataBanner />}
      <div className="mx-auto flex w-full max-w-content flex-col gap-6 px-4 py-6 compact:px-8 compact:py-7">
        <ReviewerHeader measured={data ? measuredLine(data) : null} />
        {reportCard.state === "missing" && <NoEvaluation />}
        {reportCard.state === "unreadable" && (
          <UnreadableReportCard error={reportCard.error ?? "No validation error was recorded."} />
        )}
        {data && (
          <>
            <LevelsLegend
              spotChecksClean={data.areas.reduce((sum, entry) => sum + entry.spotChecksClean, 0)}
            />
            <TrustLadderSection cards={cards} record={record} undo={undo} />
            <ReportLists
              reportCard={data}
              reviews={reviews}
              hasRealVariants={reportCard.state === "ok" && reportCard.source === "recorded"}
            />
            <BlindFirstSection reportCard={data} />
            <RoutingSpread summary={model.summary} escapeCount={total} />
          </>
        )}
        {hasLessonsLog && (
          <a
            href={LESSONS_LOG_URL}
            target="_blank"
            rel="noopener"
            className="self-start text-sm text-link hover:underline"
          >
            Lessons log
          </a>
        )}
      </div>
    </AppShell>
  );
}

function NoEvaluation() {
  return (
    <EmptyState
      title="No evaluation recorded yet."
      body="Every area is at Shadow and nothing counts as covered, so every change is Full until the reviewer is measured. Run this command to measure it."
      command="pnpm evals"
      actions={<LevelLadder level="shadow" />}
    />
  );
}

function UnreadableReportCard({ error }: Readonly<{ error: string }>) {
  return (
    <ErrorState
      title="The report card couldn't be read."
      body={
        <>
          Re-run <code className="font-mono text-sm">pnpm evals</code>. Until it reads, nothing
          counts as covered and every change is Full.
        </>
      }
      details={error}
    />
  );
}
