"use client";

import { useId } from "react";
import { Check } from "lucide-react";
import { Console } from "@/components/Console";
import { CoverageMark } from "@/components/CoverageMark";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DiffTable } from "./DiffTable";
import type { CodeToken } from "./highlightHunks";
import { hunkRawText } from "./reviewModel";
import type { HighlightedLines, HunkEntry } from "./reviewModel";
import { hunkHeaderId } from "./useDiffReveal";

/**
 * A hunk a person has to read: always open, with its coverage label, file,
 * `@@` header and the reason it is here on one strip, and Wrap, Copy and Mark
 * read beside it. Mark read is a reading aid kept in this browser tab; it
 * changes the progress count, never the tier.
 */
export function HunkCard({
  entry,
  tokens,
  highlightedLines,
  isRead,
  onToggleRead,
}: Readonly<{
  entry: HunkEntry;
  tokens?: CodeToken[][];
  highlightedLines: HighlightedLines[];
  isRead: boolean;
  onToggleRead: () => void;
}>) {
  const { hunk, coverage } = entry;
  return (
    <article data-hunk-card data-hunk-id={hunk.id} data-coverage={coverage} className="scroll-mt-4 compact:scroll-mt-scroll-clear">
      <Console
        label={`hunk ${hunk.header} in ${hunk.file}`}
        text={hunkRawText(hunk)}
        kind="diff"
        isFlush
        heading={<HunkHeading entry={entry} />}
        actions={
          <MarkReadButton isRead={isRead} onToggle={onToggleRead} />
        }
        className="rounded-control"
      >
        <DiffTable hunk={hunk} coverage={coverage} tokens={tokens} highlightedLines={highlightedLines} />
      </Console>
    </article>
  );
}

/**
 * Mark read keeps its label and shows its state with `aria-pressed` and a
 * check, so the name a screen reader or a test finds never changes. The
 * tooltip says where the mark lives: only this browser tab, not the receipt.
 */
function MarkReadButton({ isRead, onToggle }: Readonly<{ isRead: boolean; onToggle: () => void }>) {
  const noteId = useId();
  return (
    <TooltipProvider>
      <span id={noteId} className="sr-only">
        Saved in this browser only
      </span>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={isRead}
            aria-describedby={noteId}
            onClick={onToggle}
            className="text-text-muted hover:bg-surface-hover hover:text-text-primary aria-pressed:text-text-primary"
          >
            {isRead && <Check aria-hidden="true" className="size-3.5" />}
            Mark read
          </Button>
        </TooltipTrigger>
        <TooltipContent>Saved in this browser only</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/** The strip's left side: coverage, file and `@@` header, then why the hunk is here. It takes focus (not Tab) when the navigator jumps here. */
function HunkHeading({ entry }: Readonly<{ entry: HunkEntry }>) {
  const { hunk, evidence, coverage } = entry;
  return (
    <div
      id={hunkHeaderId(hunk.id)}
      tabIndex={-1}
      className="flex min-w-0 flex-1 flex-col gap-0.5 rounded-item py-1 pr-2 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5">
        <CoverageMark coverage={coverage} />
        <span className="truncate font-mono text-xs text-text-secondary">{hunk.file}</span>
        <span className="font-mono text-xs text-text-muted">{hunk.header}</span>
      </div>
      <p className="text-xs text-text-muted">{evidence}</p>
    </div>
  );
}
