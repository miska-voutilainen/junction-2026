"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Console } from "@/components/Console";
import { IdeaLabel } from "@/components/IdeaLabel";
import { CoverageMark } from "@/components/CoverageMark";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { reveal, useMotionPreset } from "@/lib/motion";
import { DiffTable } from "./DiffTable";
import type { CodeToken } from "./highlightHunks";
import { OWN_TEST_NOTE, hunkRawText } from "./reviewModel";
import type { HighlightedLines } from "./citationHighlights";
import type { HunkEntry } from "./reviewModel";
import { hunkHeaderId } from "./useDiffReveal";

/**
 * A hunk that evidence covers: one collapsed row (badge, file, `@@` header,
 * the evidence in a line, chevron) that opens to the same diff and the same
 * Wrap and Copy toolbar as a Read-this hunk, minus Mark read: nothing here
 * needs reading.
 */
export function CoveredRow({
  entry,
  tokens,
  highlightedLines,
  isExpanded,
  onToggle,
}: Readonly<{
  entry: HunkEntry;
  tokens?: CodeToken[][];
  highlightedLines: HighlightedLines[];
  isExpanded: boolean;
  onToggle: () => void;
}>) {
  const { hunk, coverage, evidence, isOwnTest } = entry;
  const contentReveal = useMotionPreset(reveal);
  const bodyId = `hunk-body-${hunk.id}`;

  return (
    <div data-hunk-card data-hunk-id={hunk.id} data-coverage={coverage} className="scroll-mt-4 compact:scroll-mt-scroll-clear">
      <div className="flex flex-col items-start transition-colors duration-(--duration-fast) ease-out hover:bg-surface-hover">
        <OwnTestTooltip isActive={isOwnTest}>
          <button
            id={hunkHeaderId(hunk.id)}
            type="button"
            aria-expanded={isExpanded}
            aria-controls={bodyId}
            onClick={onToggle}
            className="flex w-full min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 px-3 py-2 text-left"
          >
            <CoverageMark coverage={coverage} />
            <span className="min-w-0 truncate font-mono text-xs text-text-secondary">{hunk.file}</span>
            <span className="font-mono text-xs text-text-muted">{hunk.header}</span>
            <span className="ml-auto flex min-w-0 items-center gap-2 text-xs text-text-muted">
              {/* The own-test line carries the point of this row, so it wraps instead of being cut with an ellipsis; the idea label sits on its own line below. */}
              {evidence && <span className={isOwnTest ? undefined : "truncate"}>{evidence}</span>}
              {isExpanded ? (
                <ChevronDown aria-hidden="true" className="size-4 shrink-0" />
              ) : (
                <ChevronRight aria-hidden="true" className="size-4 shrink-0" />
              )}
            </span>
          </button>
        </OwnTestTooltip>
        {isOwnTest && <IdeaLabel n={8} className="mb-1.5 ml-10" />}
      </div>
      <div id={bodyId}>
        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div key="diff" {...contentReveal}>
              <Console
                label={`hunk ${hunk.header} in ${hunk.file}`}
                text={hunkRawText(hunk)}
                kind="diff"
                isFlush
                className="rounded-none border-x-0 border-b-0"
              >
                <DiffTable hunk={hunk} coverage={coverage} tokens={tokens} highlightedLines={highlightedLines} />
              </Console>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/**
 * Wraps the row's button in the note that explains an own-test line (idea 8),
 * the same tooltip the Refused chip uses. The button is the trigger, so the
 * note opens on hover and on keyboard focus too. Other rows pass through.
 */
function OwnTestTooltip({ isActive, children }: Readonly<{ isActive: boolean; children: ReactNode }>) {
  if (!isActive) return children;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent>{OWN_TEST_NOTE}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
