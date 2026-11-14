"use client";

import { useEffect, useEffectEvent, useMemo } from "react";
import type { ChangeInput, Review } from "@/contracts";
import { decideChange } from "@/features/inbox";
import type { ReportCardInput } from "@/features/inbox";
import { useEscapes } from "@/lib/simulation/escapes";
import { isTypingTarget } from "@/lib/useShortcuts";
import { CoverageLine } from "./CoverageLine";
import { DiffView } from "./DiffView";
import { HunkDropdown, HunkNavigator } from "./HunkNavigator";
import { MobileHunks } from "./MobileHunks";
import { EmptyDiff, EvidenceUnavailable } from "./ReviewStates";
import { useSelectedClaim } from "./SelectedClaim";
import type { HighlightedHunks } from "./highlightHunks";
import { buildNavigator, buildSections, evidenceAlert, highlightedLinesOf, isLineHighlighted } from "./reviewModel";
import type { HighlightedLines, HunkSections, NavigatorGroup } from "./reviewModel";
import { useDiffReveal } from "./useDiffReveal";
import { useMediaQuery } from "./useMediaQuery";
import { useReadHunks } from "./useReadHunks";

/** From this width up (`compact` in `globals.css`) the page shows the full diff; below it, the read-only list. */
const COMPACT_UP_QUERY = "(min-width: 760px)";

/**
 * Everything under the header once a review is readable: the tier and its
 * reasons, the navigator, and the diff. It owns what the pieces share: which
 * hunks are marked read, what is open, and which lines a selected claim
 * highlights. The Review steps panel will sit in a column to the right and
 * select claims through `useSelectedClaim`.
 *
 * Routing is decided here, once per review, report card and set of escapes,
 * so nothing downstream re-runs (or re-scrolls) on an unrelated render.
 */
export function ReviewBody({
  change,
  review,
  reportCard,
  tokens,
}: {
  change: ChangeInput;
  review: Review;
  reportCard: ReportCardInput;
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

  if (review.hunks.length === 0) return <EmptyDiff change={change} review={review} />;

  return (
    <>
      <CoverageLine decision={decision} />
      {reportCard.state !== "ok" && !isEvidenceAvailable && <EvidenceUnavailable alert={evidenceAlert(reportCard.state, decision)} />}
      <div className="flex items-start gap-6">
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
      </div>
    </>
  );
}

/**
 * The lines the selected claim cites. When the selection changes the first
 * of them is scrolled into view, opening the covered hunk that holds it.
 */
function useHighlightedLines(
  review: Review,
  sections: HunkSections,
  showHighlight: (hunkId: string) => void,
): HighlightedLines[] {
  const { selectedClaimId } = useSelectedClaim();
  const highlightedLines = useMemo(() => {
    const claim = review.claims.find((candidate) => candidate.id === selectedClaimId);
    return claim ? highlightedLinesOf(claim.citations) : [];
  }, [review, selectedClaimId]);

  // An effect event reads the latest sections without re-running when they change: only a new selection scrolls.
  const showFirstHighlight = useEffectEvent((lines: HighlightedLines[]) => {
    const first = [lines[0]];
    const entries = [...sections.read, ...sections.covered, ...sections.generated];
    const target = entries.find(({ hunk }) => hunk.lines.some((line) => isLineHighlighted(hunk, line, first)));
    if (target) showHighlight(target.hunk.id);
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
