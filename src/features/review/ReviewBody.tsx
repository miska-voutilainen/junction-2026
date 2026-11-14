"use client";

import { useCallback, useEffect, useEffectEvent, useMemo, useState } from "react";
import type { ChangeInput, Citation, ReceiptRecord, Review } from "@/contracts";
import { decideChange } from "@/features/inbox";
import type { ReportCardInput } from "@/features/inbox";
import { receiptStatus } from "@/lib/data/receiptStatus";
import { useEscapes } from "@/lib/simulation/escapes";
import { isTypingTarget } from "@/lib/useShortcuts";
import { CoverageLine } from "./CoverageLine";
import { DiffView } from "./DiffView";
import { HunkDropdown, HunkNavigator } from "./HunkNavigator";
import { MobileHunks } from "./MobileHunks";
import { EmptyDiff, EvidenceUnavailable } from "./ReviewStates";
import { useSelectedClaim } from "./SelectedClaim";
import type { HighlightedHunks } from "./highlightHunks";
import { buildNavigator, buildSections, evidenceAlert, highlightedLinesOf, hunkIdHolding } from "./reviewModel";
import type { HighlightedLines, HunkSections, NavigatorGroup } from "./reviewModel";
import { useDiffReveal } from "./useDiffReveal";
import { useMediaQuery } from "./useMediaQuery";
import { useReadHunks } from "./useReadHunks";
import { REVIEW_STEPS_ID, ReviewSteps } from "./steps/ReviewSteps";
import { SignBar } from "./steps/SignBar";
import type { StepId } from "./steps/stepsModel";
import { useStepKeys } from "./steps/useStepKeys";

/** From this width up (`compact` in `globals.css`) the page shows the full diff; below it, the read-only list. */
const COMPACT_UP_QUERY = "(min-width: 760px)";

/**
 * Everything under the header once a review is readable: the tier and its
 * reasons, the navigator, and the diff. It owns what the pieces share: which
 * hunks are marked read, what is open, and which lines a selected claim
 * highlights. The Review steps panel sits in a column to the right (below the
 * diff on narrower screens) and selects claims through `useSelectedClaim`.
 *
 * Routing is decided here, once per review, report card and set of escapes,
 * so nothing downstream re-runs (or re-scrolls) on an unrelated render.
 */
export function ReviewBody({
  change,
  review,
  reportCard,
  record,
  tokens,
}: {
  change: ChangeInput;
  review: Review;
  reportCard: ReportCardInput;
  /** The change's receipt, or null when it has none or the file is unreadable. */
  record: ReceiptRecord | null;
  tokens: HighlightedHunks;
}) {
  const { escapes } = useEscapes();
  const { decision, levels, isEvidenceAvailable } = useMemo(() => decideChange(review, reportCard, escapes), [review, reportCard, escapes]);
  const sections = useMemo(() => buildSections(review, decision, levels), [review, decision, levels]);
  const groups = useMemo(() => buildNavigator(sections), [sections]);
  const reveal = useDiffReveal(sections);
  const { readIds, toggle } = useReadHunks(change.id);
  // One tree per layout: the full diff from 760 px, the read-only list below. Both are
  // CSS-hidden on the other side too, so the server's HTML shows the right one before hydration.
  const hasFullDiff = useMediaQuery(COMPACT_UP_QUERY, true);
  const highlightedLines = useHighlightedLines(review, sections, reveal.showHighlight);
  useHunkKeys(hasFullDiff ? groups : [], reveal.activeHunkId, reveal.jumpTo);
  const [step, setStep] = useState<StepId>("read");
  useStepKeys(setStep);
  const status = receiptStatus(review, record);
  const showCitation = useCallback(
    (citation: Citation) => {
      const hunkId = hunkIdHolding(sections, citation);
      if (hunkId) reveal.showHighlight(hunkId);
    },
    [sections, reveal],
  );
  const openSign = useCallback(() => {
    setStep("sign");
    document.getElementById(REVIEW_STEPS_ID)?.scrollIntoView({ block: "start" });
  }, []);

  if (review.hunks.length === 0) return <EmptyDiff change={change} review={review} />;

  return (
    <>
      <CoverageLine decision={decision} />
      {reportCard.state !== "ok" && !isEvidenceAvailable && <EvidenceUnavailable alert={evidenceAlert(reportCard.state, decision)} />}
      <div className="flex flex-col gap-6 wide:flex-row wide:items-start">
        <HunkNavigator groups={groups} activeHunkId={reveal.activeHunkId} readIds={readIds} onJump={reveal.jumpTo} />
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <HunkDropdown groups={groups} activeHunkId={reveal.activeHunkId} onJump={reveal.jumpTo} />
          {hasFullDiff && (
            <div className="hidden compact:block">
              <DiffView
                sections={sections}
                tokens={tokens}
                highlightedLines={highlightedLines}
                reveal={reveal}
                readIds={readIds}
                onToggleRead={toggle}
              />
            </div>
          )}
          <MobileHunks sections={sections} tokens={tokens} highlightedLines={highlightedLines} />
        </div>
        <div className="w-full wide:w-steps-panel wide:shrink-0 wide:self-stretch">
          <ReviewSteps
            review={review}
            reportCard={reportCard}
            record={record}
            status={status}
            step={step}
            onStepChange={setStep}
            onShowHunk={reveal.jumpTo}
            onShowCitation={showCitation}
          />
        </div>
      </div>
      {/* Room for the phone's fixed Sign bar, so it never covers the end of the page. */}
      <div aria-hidden="true" className="h-14 compact:hidden" />
      <SignBar status={status} onOpenSign={openSign} />
    </>
  );
}

/**
 * The lines the selected claim or finding cites. When the selection changes the first
 * of them is scrolled into view, opening the covered hunk that holds it.
 */
function useHighlightedLines(
  review: Review,
  sections: HunkSections,
  showHighlight: (hunkId: string) => void,
): HighlightedLines[] {
  const { selectedClaimId, selectedFindingId } = useSelectedClaim();
  const highlightedLines = useMemo(() => {
    const selected =
      review.claims.find((claim) => claim.id === selectedClaimId) ?? review.findings.find((finding) => finding.id === selectedFindingId);
    return selected ? highlightedLinesOf(selected.citations) : [];
  }, [review, selectedClaimId, selectedFindingId]);

  // An effect event reads the latest sections without re-running when they change: only a new selection scrolls.
  const showFirstHighlight = useEffectEvent((lines: HighlightedLines[]) => {
    const hunkId = hunkIdHolding(sections, lines[0]);
    if (hunkId) showHighlight(hunkId);
  });
  useEffect(() => {
    if (highlightedLines.length > 0) showFirstHighlight(highlightedLines);
  }, [highlightedLines]);

  return highlightedLines;
}

/** `j` and `k` jump to the next and previous hunk in navigator order, except while typing. */
function useHunkKeys(groups: NavigatorGroup[], activeHunkId: string | null, jumpTo: (hunkId: string) => void): void {
  useEffect(() => {
    const items = groups.flatMap((group) => group.items);
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) return;
      const step = event.key === "j" ? 1 : event.key === "k" ? -1 : 0;
      if (step === 0 || items.length === 0) return;
      event.preventDefault();
      const current = items.findIndex((item) => item.hunkId === activeHunkId);
      // With nothing active yet, j lands on the first hunk and k on the last, as in the inbox.
      const next = current === -1 ? (step === 1 ? 0 : items.length - 1) : Math.min(items.length - 1, Math.max(0, current + step));
      jumpTo(items[next].hunkId);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [groups, activeHunkId, jumpTo]);
}
