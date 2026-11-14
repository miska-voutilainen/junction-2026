"use client";

import { Disclosure } from "@/components/Disclosure";
import { CoveredRow } from "./CoveredRow";
import { HunkCard } from "./HunkCard";
import type { HighlightedHunks } from "./highlightHunks";
import { coveredSummary } from "./reviewModel";
import type { HighlightedLines, HunkEntry, HunkSections } from "./reviewModel";
import type { DiffReveal } from "./useDiffReveal";

interface DiffViewProps {
  sections: HunkSections;
  tokens: HighlightedHunks;
  highlightedLines: HighlightedLines[];
  reveal: DiffReveal;
  readIds: ReadonlySet<string>;
  onToggleRead: (hunkId: string) => void;
}

/**
 * The diff, ordered by what a person has to do: the hunks to read open and
 * first, the evidence-covered ones below in collapsed rows, covered generated
 * snapshot files last. This ordering is the hunk coverage map (idea 3) made
 * visible: the reader sees what to read before anything else.
 */
export function DiffView({ sections, tokens, highlightedLines, reveal, readIds, onToggleRead }: DiffViewProps) {
  const coveredCount = sections.covered.length + sections.generated.length;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <ReadThisSection
        entries={sections.read}
        coveredCount={coveredCount}
        tokens={tokens}
        highlightedLines={highlightedLines}
        readIds={readIds}
        onToggleRead={onToggleRead}
      />
      {coveredCount > 0 && (
        <Disclosure
          isOpen={reveal.isCoveredOpen}
          onOpenChange={reveal.setCoveredOpen}
          className="rounded-control border border-dashed border-border-default px-2 py-1"
          title={
            <span className="flex w-full items-baseline justify-between gap-3">
              <span>
                Covered by evidence: {coveredCount} {coveredCount === 1 ? "hunk" : "hunks"}
              </span>
              <span className="text-xs text-text-muted">{coveredSummary([...sections.covered, ...sections.generated])}</span>
            </span>
          }
        >
          <div className="mb-1 flex flex-col gap-3">
            {sections.covered.length > 0 && (
              <CoveredList entries={sections.covered} tokens={tokens} highlightedLines={highlightedLines} reveal={reveal} />
            )}
            {sections.generated.length > 0 && (
              <GeneratedFiles entries={sections.generated} tokens={tokens} highlightedLines={highlightedLines} reveal={reveal} />
            )}
          </div>
        </Disclosure>
      )}
    </div>
  );
}

function ReadThisSection({
  entries,
  coveredCount,
  tokens,
  highlightedLines,
  readIds,
  onToggleRead,
}: {
  entries: HunkEntry[];
  coveredCount: number;
  tokens: HighlightedHunks;
  highlightedLines: HighlightedLines[];
  readIds: ReadonlySet<string>;
  onToggleRead: (hunkId: string) => void;
}) {
  if (entries.length === 0) {
    return (
      <p className="rounded-control border border-border-subtle bg-surface-panel px-3 py-2 text-base text-text-secondary">
        Nothing to read: evidence covers all {coveredCount} hunks.
      </p>
    );
  }
  return (
    <section aria-labelledby="read-this-heading" className="flex flex-col gap-3">
      <h2 id="read-this-heading" className="flex items-center gap-3 text-sm font-medium text-amber">
        <span>
          Read this: {entries.length} {entries.length === 1 ? "hunk" : "hunks"}
        </span>
        <span aria-hidden="true" className="h-px flex-1 bg-border-subtle" />
      </h2>
      {entries.map((entry) => (
        <HunkCard
          key={entry.hunk.id}
          entry={entry}
          tokens={tokens[entry.hunk.id]}
          highlightedLines={highlightedLines}
          isRead={readIds.has(entry.hunk.id)}
          onToggleRead={() => onToggleRead(entry.hunk.id)}
        />
      ))}
    </section>
  );
}

interface CoveredListProps {
  entries: HunkEntry[];
  tokens: HighlightedHunks;
  highlightedLines: HighlightedLines[];
  reveal: DiffReveal;
}

function CoveredList({ entries, tokens, highlightedLines, reveal }: CoveredListProps) {
  return (
    <div className="divide-y divide-border-subtle overflow-hidden rounded-control border border-border-subtle bg-surface-code">
      {entries.map((entry) => (
        <CoveredRow
          key={entry.hunk.id}
          entry={entry}
          tokens={tokens[entry.hunk.id]}
          highlightedLines={highlightedLines}
          isExpanded={reveal.expandedIds.has(entry.hunk.id)}
          onToggle={() => reveal.toggleExpanded(entry.hunk.id)}
        />
      ))}
    </div>
  );
}

function GeneratedFiles({ entries, tokens, highlightedLines, reveal }: CoveredListProps) {
  const fileCount = new Set(entries.map((entry) => entry.hunk.file)).size;
  const noun = fileCount === 1 ? "generated snapshot file" : "generated snapshot files";
  return (
    <Disclosure
      isOpen={reveal.isGeneratedOpen}
      onOpenChange={reveal.setGeneratedOpen}
      title={`${fileCount} ${noun} · ${reveal.isGeneratedOpen ? "Hide" : "Show"}`}
    >
      <CoveredList entries={entries} tokens={tokens} highlightedLines={highlightedLines} reveal={reveal} />
    </Disclosure>
  );
}
