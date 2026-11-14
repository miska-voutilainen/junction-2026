"use client";

import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Console } from "@/components/Console";
import { CoverageMark } from "@/components/CoverageMark";
import { reveal, useMotionPreset } from "@/lib/motion";
import { DiffTable } from "./DiffTable";
import type { CodeToken } from "./highlightHunks";
import { hunkRawText } from "./reviewModel";
import type { HighlightedLines, HunkEntry } from "./reviewModel";
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
}: {
  entry: HunkEntry;
  tokens?: CodeToken[][];
  highlightedLines: HighlightedLines[];
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const { hunk, coverage, evidence } = entry;
  const contentReveal = useMotionPreset(reveal);
  const bodyId = `hunk-body-${hunk.id}`;

  return (
    <div data-hunk-card data-hunk-id={hunk.id} data-coverage={coverage} className="scroll-mt-4">
      <button
        id={hunkHeaderId(hunk.id)}
        type="button"
        aria-expanded={isExpanded}
        aria-controls={bodyId}
        onClick={onToggle}
        className="flex w-full flex-wrap items-center gap-x-3 gap-y-0.5 px-3 py-2 text-left transition-colors duration-(--duration-fast) ease-out hover:bg-surface-hover"
      >
        <CoverageMark coverage={coverage} />
        <span className="min-w-0 truncate font-mono text-xs text-text-secondary">{hunk.file}</span>
        <span className="font-mono text-xs text-text-muted">{hunk.header}</span>
        <span className="ml-auto flex min-w-0 items-center gap-2 text-xs text-text-muted">
          <span className="truncate">{evidence}</span>
          {isExpanded ? (
            <ChevronDown aria-hidden="true" className="size-4 shrink-0" />
          ) : (
            <ChevronRight aria-hidden="true" className="size-4 shrink-0" />
          )}
        </span>
      </button>
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
