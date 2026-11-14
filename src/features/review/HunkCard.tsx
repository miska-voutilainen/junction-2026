"use client";

import { Check } from "lucide-react";
import { Console } from "@/components/Console";
import { CoverageMark } from "@/components/CoverageMark";
import { Button } from "@/components/ui/button";
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
}: {
  entry: HunkEntry;
  tokens?: CodeToken[][];
  highlightedLines: HighlightedLines[];
  isRead: boolean;
  onToggleRead: () => void;
}) {
  const { hunk, coverage } = entry;
  return (
    <article data-hunk-card data-hunk-id={hunk.id} data-coverage={coverage} className="scroll-mt-4">
      <Console
        label={`hunk ${hunk.header} in ${hunk.file}`}
        text={hunkRawText(hunk)}
        kind="diff"
        isFlush
        heading={<HunkHeading entry={entry} />}
        actions={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={isRead}
            onClick={onToggleRead}
            className="text-text-muted hover:bg-surface-hover hover:text-text-primary aria-pressed:text-text-primary"
          >
            {isRead && <Check aria-hidden="true" className="size-3.5" />}
            {isRead ? "Read" : "Mark read"}
          </Button>
        }
        className="rounded-control"
      >
        <DiffTable hunk={hunk} coverage={coverage} tokens={tokens} highlightedLines={highlightedLines} />
      </Console>
    </article>
  );
}

/** The strip's left side: coverage, file and `@@` header, then why the hunk is here. It takes focus (not Tab) when the navigator jumps here. */
function HunkHeading({ entry }: { entry: HunkEntry }) {
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
