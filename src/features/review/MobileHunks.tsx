"use client";

import { CopyButton } from "@/components/CopyButton";
import { Disclosure } from "@/components/Disclosure";
import { DiffTable } from "./DiffTable";
import type { HighlightedHunks } from "./highlightHunks";
import { coveredSummary, fileName, hunkRawText } from "./reviewModel";
import type { HighlightedLines, HunkEntry, HunkSections } from "./reviewModel";

/**
 * The phone's view of the diff: reading code works best on a desktop, so the
 * hunks to read sit behind "Read-only hunks", wrapped, with Copy and nothing
 * else, and the covered hunks are one summary line. Below 760 px.
 */
export function MobileHunks({
  sections,
  tokens,
  highlightedLines,
}: Readonly<{
  sections: HunkSections;
  tokens: HighlightedHunks;
  highlightedLines: HighlightedLines[];
}>) {
  const covered = sections.covered;
  return (
    <div className="flex flex-col gap-3 compact:hidden">
      <p className="text-base text-text-secondary">Reading code works best on a desktop. These hunks are read-only.</p>
      {sections.read.length > 0 && (
        <Disclosure title={`Read-only hunks (${sections.read.length})`} className="rounded-control border border-border-subtle px-2 py-1">
          <div className="flex flex-col gap-3 pb-2">
            {sections.read.map((entry) => (
              <ReadOnlyHunk key={entry.hunk.id} entry={entry} tokens={tokens} highlightedLines={highlightedLines} />
            ))}
          </div>
        </Disclosure>
      )}
      {covered.length > 0 && (
        <p className="text-base text-text-muted">
          Covered by evidence: {covered.length} {covered.length === 1 ? "hunk" : "hunks"} · {coveredSummary(covered)}
        </p>
      )}
      {sections.generated.length > 0 && (
        <p className="text-base text-text-muted">
          Generated: {sections.generated.length} {sections.generated.length === 1 ? "hunk" : "hunks"}, not in the reading count
        </p>
      )}
    </div>
  );
}

function ReadOnlyHunk({ entry, tokens, highlightedLines }: Readonly<{ entry: HunkEntry; tokens: HighlightedHunks; highlightedLines: HighlightedLines[] }>) {
  const { hunk, coverage } = entry;
  const label = `${fileName(hunk.file)} ${hunk.header}`;
  return (
    <div className="min-w-0 rounded-control border border-border-subtle bg-surface-code">
      <div className="flex items-center justify-between gap-2 border-b border-border-subtle py-1 pr-1.5 pl-3">
        <span className="truncate font-mono text-xs text-text-secondary">{label}</span>
        <CopyButton text={hunkRawText(hunk)} label={`Copy hunk ${label}`} />
      </div>
      <div className="font-mono text-sm whitespace-pre-wrap text-text-secondary [overflow-wrap:anywhere]">
        <DiffTable hunk={hunk} coverage={coverage} tokens={tokens[hunk.id]} highlightedLines={highlightedLines} isCompact />
      </div>
    </div>
  );
}
