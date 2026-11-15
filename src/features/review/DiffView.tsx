"use client";

import { Disclosure } from "@/components/Disclosure";
import { CoveredRow } from "./CoveredRow";
import { HunkCard } from "./HunkCard";
import type { HighlightedHunks } from "./highlightHunks";
import { coveredSummary, generatedFilesLabel } from "./reviewModel";
import type { HighlightedLines } from "./citationHighlights";
import type { HunkEntry, HunkSections } from "./reviewModel";
import type { DiffReveal } from "./useDiffReveal";
import { countOf } from "@/lib/countOf";

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
export function DiffView({
  sections,
  tokens,
  highlightedLines,
  reveal,
  readIds,
  onToggleRead,
}: Readonly<DiffViewProps>) {
  const coveredCount = sections.covered.length;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <ReadThisSection
        entries={sections.read}
        coveredCount={coveredCount}
        generatedCount={sections.generated.length}
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
              <span>Covered by evidence: {countOf(coveredCount, "hunk")}</span>
              <span className="text-xs text-text-muted">{coveredSummary(sections.covered)}</span>
            </span>
          }
        >
          <div className="mb-1 flex flex-col gap-3">
            <CoveredList
              entries={sections.covered}
              tokens={tokens}
              highlightedLines={highlightedLines}
              reveal={reveal}
            />
          </div>
        </Disclosure>
      )}
      {sections.generated.length > 0 && (
        <GeneratedFiles
          entries={sections.generated}
          tokens={tokens}
          highlightedLines={highlightedLines}
          reveal={reveal}
        />
      )}
    </div>
  );
}

function ReadThisSection({
  entries,
  coveredCount,
  generatedCount,
  tokens,
  highlightedLines,
  readIds,
  onToggleRead,
}: Readonly<{
  entries: HunkEntry[];
  coveredCount: number;
  generatedCount: number;
  tokens: HighlightedHunks;
  highlightedLines: HighlightedLines[];
  readIds: ReadonlySet<string>;
  onToggleRead: (hunkId: string) => void;
}>) {
  if (entries.length === 0) {
    return (
      <p className="rounded-control border border-border-subtle bg-surface-panel px-3 py-2 text-base text-text-secondary">
        {nothingToReadText(coveredCount, generatedCount)}
      </p>
    );
  }
  return (
    <section aria-labelledby="read-this-heading" className="flex flex-col gap-3">
      <h2 id="read-this-heading" className="flex items-center gap-3 text-sm font-medium text-amber">
        <span>Read this: {countOf(entries.length, "hunk")}</span>
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

/** "Nothing to read: evidence covers all 8 hunks.", or with snapshots: "...covers 2 hunks; the other 411 are generated files." */
function nothingToReadText(coveredCount: number, generatedCount: number): string {
  if (generatedCount === 0) return `Nothing to read: evidence covers all ${coveredCount} hunks.`;
  if (coveredCount === 0)
    return generatedCount === 1
      ? "Nothing to read: the one hunk is a generated file."
      : `Nothing to read: all ${generatedCount} hunks are generated files.`;
  const covered = countOf(coveredCount, "hunk");
  const others =
    generatedCount === 1
      ? "the other hunk is a generated file"
      : `the other ${generatedCount} are generated files`;
  return `Nothing to read: evidence covers ${covered}; ${others}.`;
}

interface CoveredListProps {
  entries: HunkEntry[];
  tokens: HighlightedHunks;
  highlightedLines: HighlightedLines[];
  reveal: DiffReveal;
}

function CoveredList({ entries, tokens, highlightedLines, reveal }: Readonly<CoveredListProps>) {
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

/** Generated hunks: visible, collapsed, and outside the reading count; the title says so. */
function GeneratedFiles({ entries, tokens, highlightedLines, reveal }: Readonly<CoveredListProps>) {
  return (
    <Disclosure
      isOpen={reveal.isGeneratedOpen}
      onOpenChange={reveal.setGeneratedOpen}
      className="rounded-control border border-dashed border-border-default px-2 py-1"
      title={`${generatedFilesLabel(entries)} · not in the reading count · ${reveal.isGeneratedOpen ? "Hide" : "Show"}`}
    >
      <p className="px-1 pb-2 text-xs text-text-muted">
        {
          "Generated files aren't read, so code hidden in one wouldn't be caught. Read the template that produces them."
        }
      </p>
      <CoveredList
        entries={entries}
        tokens={tokens}
        highlightedLines={highlightedLines}
        reveal={reveal}
      />
    </Disclosure>
  );
}
