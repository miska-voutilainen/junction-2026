/**
 * Which lines of the diff a selected claim or finding points at. Each citation
 * carries the mechanical quote check's verdict (idea 4): a quote that was not
 * found in the code is never highlighted or shown, so the reviewer is never
 * sent to lines the AI misquoted. Pure functions, no React.
 */
import type { Citation, Review } from "@/contracts";
import type { HunkSections } from "./reviewModel";

type Hunk = Review["hunks"][number];

/** A span of lines in one file the diff should highlight, e.g. the lines a selected claim cites. */
export interface HighlightedLines {
  file: string;
  side: "new" | "old";
  startLine: number;
  endLine: number;
}

/** The lines a claim cites, as highlight ranges. */
export function highlightedLinesOf(citations: Citation[]): HighlightedLines[] {
  return citations.map(({ file, side, startLine, endLine }) => ({ file, side, startLine, endLine }));
}

/** Whether a line of `hunk` (by its old or new number) falls in any highlight range. */
export function isLineHighlighted(
  hunk: Hunk,
  line: Hunk["lines"][number],
  highlights: HighlightedLines[],
): boolean {
  return highlights.some((range) => {
    if (range.file !== hunk.file) return false;
    const number = range.side === "new" ? line.newLine : line.oldLine;
    return number !== null && number >= range.startLine && number <= range.endLine;
  });
}

/** A citation and whether the mechanical quote check found its quote in the code. */
export interface CheckedCitation {
  citation: Citation;
  /** False when the quote check failed on it: the quote isn't in the cited lines, so it is never shown or highlighted. */
  isQuoteFound: boolean;
}

/**
 * The citations of one claim or finding (`itemId`), each marked with the
 * quote check's verdict; a citation the check never failed counts as found.
 * A claim's failures are recorded under its own id ("c2"). A finding's are
 * recorded under the model's item number ("a3-f2", "a4-s1"), which no longer
 * matches the finding's id ("f1") once the check has dropped a finding, so a
 * finding matches those failures on the cited file, side, lines and quote.
 * A failure with no citation (an unknown rule id) matches none.
 */
export function splitCitations(review: Review, itemId: string, citations: Citation[]): CheckedCitation[] {
  const isFinding = /^f\d+$/.test(itemId);
  const failures = review.quoteCheck.failures.filter((failure) =>
    isFinding ? /^a[34]-/.test(failure.itemId) : failure.itemId === itemId,
  );
  return citations.map((citation) => ({
    citation,
    isQuoteFound: !failures.some(
      ({ citation: failed }) =>
        failed !== null && isSameLocation(failed, citation) && (!isFinding || failed.quote === citation.quote),
    ),
  }));
}

function isSameLocation(a: HighlightedLines, b: HighlightedLines): boolean {
  return a.file === b.file && a.side === b.side && a.startLine === b.startLine && a.endLine === b.endLine;
}

/**
 * The lines the diff highlights for a selection: its citations whose quote
 * was found. A retracted claim highlights nothing, because the review no
 * longer stands behind it.
 */
export function highlightedLinesOfSelection(review: Review, selection: { kind: "claim" | "finding"; id: string } | null): HighlightedLines[] {
  if (selection === null) return [];
  if (selection.kind === "claim") {
    const claim = review.claims.find((candidate) => candidate.id === selection.id);
    if (!claim || review.retractions.some((retraction) => retraction.claimId === claim.id)) return [];
    return foundLines(review, claim.id, claim.citations);
  }
  const finding = review.findings.find((candidate) => candidate.id === selection.id);
  return finding ? foundLines(review, finding.id, finding.citations) : [];
}

function foundLines(review: Review, itemId: string, citations: Citation[]): HighlightedLines[] {
  return highlightedLinesOf(splitCitations(review, itemId, citations).filter((entry) => entry.isQuoteFound).map((entry) => entry.citation));
}

/** Where to scroll for a selection: its focused citation when that one is highlighted, else the first highlighted line; null with no lines. */
export function scrollTargetOf(lines: HighlightedLines[], focus: Citation | undefined): HighlightedLines | null {
  const focused = focus && lines.find((line) => isSameLocation(line, focus));
  return focused ?? lines[0] ?? null;
}

/** The id of the first hunk (read, covered or generated) that holds a line in `range`, or null when no hunk does. */
export function hunkIdHolding(sections: HunkSections, range: HighlightedLines): string | null {
  const entries = [...sections.read, ...sections.covered, ...sections.generated];
  const holder = entries.find(({ hunk }) => hunk.lines.some((line) => isLineHighlighted(hunk, line, [range])));
  return holder?.hunk.id ?? null;
}
