"use client";

import { useEffect, useMemo } from "react";
import type { Area, ChangeInput, LadderLevel, Review, TierDecision } from "@/contracts";
import { isTypingTarget } from "@/lib/useShortcuts";
import { CoverageLine } from "./CoverageLine";
import { DiffView } from "./DiffView";
import { HunkDropdown, HunkNavigator } from "./HunkNavigator";
import { MobileHunks } from "./MobileHunks";
import { EmptyDiff, EvidenceUnavailable } from "./ReviewStates";
import { useSelectedClaim } from "./SelectedClaim";
import type { HighlightedHunks } from "./highlightHunks";
import { buildNavigator, buildSections, highlightedLinesOf, isLineHighlighted } from "./reviewModel";
import type { HighlightedLines, HunkSections, NavigatorGroup } from "./reviewModel";
import { useDiffReveal } from "./useDiffReveal";
import { useReadHunks } from "./useReadHunks";

/**
 * Everything under the header once a review is readable: the tier and its
 * reasons, the navigator, and the diff. It owns what the pieces share: which
 * hunks are marked read, what is open, and which lines a selected claim
 * highlights. The Review steps panel will sit in a column to the right and
 * select claims through `useSelectedClaim`.
 */
export function ReviewBody({
  change,
  review,
  decision,
  levels,
  isEvidenceAvailable,
  tokens,
}: {
  change: ChangeInput;
  review: Review;
  decision: TierDecision;
  levels: Record<Area, LadderLevel>;
  isEvidenceAvailable: boolean;
  tokens: HighlightedHunks;
}) {
  const sections = useMemo(() => buildSections(review, decision, levels), [review, decision, levels]);
  const groups = useMemo(() => buildNavigator(sections), [sections]);
  const reveal = useDiffReveal(sections);
  const { readIds, toggle } = useReadHunks(change.id);
  const highlightedLines = useHighlightedLines(review, sections, reveal.showHighlight);
  useHunkKeys(groups, reveal.activeHunkId, reveal.jumpTo);

  if (review.hunks.length === 0) return <EmptyDiff change={change} review={review} />;

  return (
    <>
      <CoverageLine decision={decision} />
      {!isEvidenceAvailable && <EvidenceUnavailable decision={decision} />}
      <div className="flex items-start gap-6">
        <HunkNavigator groups={groups} activeHunkId={reveal.activeHunkId} readIds={readIds} onJump={reveal.jumpTo} />
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <HunkDropdown groups={groups} activeHunkId={reveal.activeHunkId} onJump={reveal.jumpTo} />
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

  useEffect(() => {
    if (highlightedLines.length === 0) return;
    const first = [highlightedLines[0]];
    const entries = [...sections.read, ...sections.covered, ...sections.generated];
    const target = entries.find(({ hunk }) => hunk.lines.some((line) => isLineHighlighted(hunk, line, first)));
    if (target) showHighlight(target.hunk.id);
  }, [highlightedLines, sections, showHighlight]);

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
