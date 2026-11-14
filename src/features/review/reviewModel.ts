/**
 * The review page as data: which hunks the human reads, which are covered by
 * evidence and why, in the order the navigator and the diff both show them.
 * The coverage itself comes from `route()` (hunk coverage map, spec section
 * 5); this file only arranges it. Pure functions, no React.
 */
import type { Area, Citation, Coverage, LadderLevel, Review, TierDecision } from "@/contracts";

type Hunk = Review["hunks"][number];
type File = Review["files"][number];

/** One hunk with everything the page needs to draw it. */
export interface HunkEntry {
  hunk: Hunk;
  file: File;
  coverage: Coverage;
  /** Line range on the new side, e.g. "737–745"; the start alone for a pure deletion. */
  range: string;
  /** Why this hunk has the coverage it has, in one line. */
  evidence: string;
  /** True when the only test behind this hunk is the PR's own (idea 8); the view adds the idea label. */
  isOwnTest: boolean;
}

/** The hunks split the way the diff shows them. */
export interface HunkSections {
  /** Hunks a person reads, in diff order. */
  read: HunkEntry[];
  /** Covered hunks of ordinary files, in diff order. */
  covered: HunkEntry[];
  /** Covered hunks of generated files; shown collapsed as snapshot files. */
  generated: HunkEntry[];
}

/** One line of the navigator: a hunk, or all covered generated files of a group as one item. */
export interface NavigatorItem {
  /** The hunk to scroll to; for the generated item, the first generated hunk of the group. */
  hunkId: string;
  label: string;
  coverage: Coverage;
  area: Area | null;
  isGenerated: boolean;
}

/** A navigator group in display order, with its hunk count (generated hunks included). */
export interface NavigatorGroup {
  coverage: Coverage;
  title: string;
  hunkCount: number;
  items: NavigatorItem[];
}

const GROUP_ORDER: Coverage[] = ["read", "supported", "verified"];
const GROUP_TITLE: Record<Coverage, string> = { read: "Read this", supported: "Supported", verified: "Verified" };

/** Last path segment: "src/a/Foo.cs" -> "Foo.cs". */
export function fileName(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

/** New-side line range of a hunk: "737–745"; the start alone when it covers at most one new line (including a hunk that only deletes). */
export function hunkRange(hunk: Hunk): string {
  if (hunk.newLines <= 1) return String(hunk.newStart);
  return `${hunk.newStart}–${hunk.newStart + hunk.newLines - 1}`;
}

/**
 * The hunks of a review with their coverage, split into what a person reads,
 * what evidence covers and the covered generated files.
 *
 * A generated file only collapses when evidence covers it: a generated hunk
 * route() marks "read" is something a person must read, so it stays in `read`.
 */
export function buildSections(review: Review, decision: TierDecision, levels: Record<Area, LadderLevel>): HunkSections {
  const fileOf = new Map(review.files.map((file) => [file.path, file]));
  const sections: HunkSections = { read: [], covered: [], generated: [] };
  for (const hunk of review.hunks) {
    const file = fileOf.get(hunk.file);
    if (!file) throw new Error(`Review ${review.changeId} has hunk ${hunk.id} in ${hunk.file}, which is not in its file list. Re-record it with pnpm review run ${review.changeId}.`);
    const coverage = decision.coverage[hunk.id];
    const entry: HunkEntry = {
      hunk,
      file,
      coverage,
      range: hunkRange(hunk),
      evidence: evidenceLine(review, hunk, coverage, file.area ? levels[file.area] : null),
      isOwnTest: isCoveredByOwnTestOnly(review, hunk, coverage),
    };
    if (coverage === "read") sections.read.push(entry);
    else if (file.kind === "generated") sections.generated.push(entry);
    else sections.covered.push(entry);
  }
  return sections;
}

/**
 * One line saying what covers a hunk, from its claims, findings and refusals.
 *
 * - Verified: "Test passes on this change: <test name>"
 * - Supported: "Quote checked: <file>:<line>"
 * - Read this: the finding and refusal titles, else why nothing covers it
 *
 * @param areaLevel trust level of the hunk's area, null when the file has no area
 */
function evidenceLine(review: Review, hunk: Hunk, coverage: Coverage, areaLevel: LadderLevel | null): string {
  if (coverage === "read") return readReason(review, hunk, areaLevel);
  const claims = claimsAtLevel(review, hunk, coverage);
  if (coverage === "verified") return verifiedLine(claims);
  if (isCoveredByOwnTestOnly(review, hunk, coverage)) return ownTestLine(hunk, claims);
  return supportedLine(hunk, claims);
}

type Claim = Review["claims"][number];

/** How a claim backed only by the PR's own test is named, on the hunk line and in the Read step. */
export const OWN_TEST_LABEL = "Supported · the PR's own test";

/** The own-test label, followed by the checked quote the claim also cites, when it cites one: "Supported · the PR's own test · quote checked at Foo.cs:12". */
function ownTestLine(hunk: Hunk, claims: Claim[]): string {
  const citations = claims.flatMap((claim) => claim.citations);
  const citation = citations.find((candidate) => citationOverlapsHunk(candidate, hunk)) ?? citations[0];
  return citation ? `${OWN_TEST_LABEL} · quote checked at ${fileName(citation.file)}:${citation.startLine}` : OWN_TEST_LABEL;
}

/** Why such a claim stops at Supported (idea 8): shown as the label's description. */
export const OWN_TEST_NOTE = "The same agent wrote the code and this test, so it can't make the claim Verified.";

/**
 * Whether a claim's only test evidence is the test the PR ships. Only a
 * differential test (fails on the base, passes on the change) written by
 * someone else can make a claim Verified; the author's own test cannot.
 */
export function isOwnTestOnly(claim: Claim): boolean {
  const hasOwnTest = claim.evidence.some((item) => item.kind === "pr-test");
  return hasOwnTest && !claim.evidence.some((item) => item.kind === "differential-test");
}

function isCoveredByOwnTestOnly(review: Review, hunk: Hunk, coverage: Coverage): boolean {
  if (coverage !== "supported") return false;
  const claims = claimsAtLevel(review, hunk, coverage);
  return claims.length > 0 && claims.every(isOwnTestOnly);
}

function claimsAtLevel(review: Review, hunk: Hunk, level: Coverage): Claim[] {
  return review.claims.filter((claim) => claim.hunkIds.includes(hunk.id) && claim.level === level);
}

function verifiedLine(claims: Claim[]): string {
  const testName = claims.flatMap((claim) => claim.evidence).find((item) => item.testName !== null)?.testName;
  if (testName) return `Test passes on this change: ${testName}`;
  return `Verified by claim ${claims[0]?.id ?? "unknown"}: ${claims[0]?.text ?? "no claim text recorded"}`;
}

/**
 * A quote that sits inside this hunk reads "Quote checked: <file>:<line>". A
 * claim can cover a hunk through a citation elsewhere, e.g. in the test file;
 * then the line says so, instead of pointing at lines the hunk doesn't show.
 */
function supportedLine(hunk: Hunk, claims: Claim[]): string {
  const inside = claims.flatMap((claim) => claim.citations).find((citation) => citationOverlapsHunk(citation, hunk));
  if (inside) return `Quote checked: ${fileName(inside.file)}:${inside.startLine}`;
  const claim = claims[0];
  const outside = claim?.citations[0];
  if (claim && outside) return `Supported by ${claim.id} · quote checked at ${fileName(outside.file)}:${outside.startLine}, outside this hunk`;
  return `Supported by ${claim?.id ?? "unknown"}: ${claim?.evidence[0]?.summary ?? claim?.text ?? "no evidence summary recorded"}`;
}

/** Whether a citation names lines this hunk shows: same file, and its range meets a line of the hunk (same test as `isLineHighlighted`). */
function citationOverlapsHunk(citation: Citation, hunk: Hunk): boolean {
  return hunk.lines.some((line) => isLineHighlighted(hunk, line, [citation]));
}

function readReason(review: Review, hunk: Hunk, areaLevel: LadderLevel | null): string {
  const findings = review.findings.filter((finding) => finding.hunkIds.includes(hunk.id)).map((finding) => finding.title);
  const refusals = review.refusals.filter((refusal) => refusal.hunkIds.includes(hunk.id)).map((refusal) => `Refused under ${refusal.ruleId}`);
  const flagged = [...findings, ...refusals];
  if (flagged.length > 0) return flagged.join(" · ");
  if (areaLevel === "shadow") return "Area is at Shadow: no track record";
  return "No checked evidence";
}

/**
 * The navigator's groups: "Read this", "Supported", "Verified", empty ones
 * omitted. Covered generated hunks of a group become one item, "<n> generated
 * snapshot files", so a snapshot-heavy change doesn't drown the list.
 */
export function buildNavigator(sections: HunkSections): NavigatorGroup[] {
  const groups: NavigatorGroup[] = [];
  for (const coverage of GROUP_ORDER) {
    const hunkEntries = [...sections.read, ...sections.covered].filter((entry) => entry.coverage === coverage);
    const generated = sections.generated.filter((entry) => entry.coverage === coverage);
    const items: NavigatorItem[] = hunkEntries.map((entry) => ({
      hunkId: entry.hunk.id,
      label: `${fileName(entry.hunk.file)}:${entry.range}`,
      coverage,
      area: entry.file.area,
      isGenerated: false,
    }));
    if (generated.length > 0) {
      const fileCount = new Set(generated.map((entry) => entry.hunk.file)).size;
      items.push({
        hunkId: generated[0].hunk.id,
        label: `${fileCount} generated snapshot ${fileCount === 1 ? "file" : "files"}`,
        coverage,
        area: null,
        isGenerated: true,
      });
    }
    if (items.length === 0) continue;
    groups.push({ coverage, title: GROUP_TITLE[coverage], hunkCount: hunkEntries.length + generated.length, items });
  }
  return groups;
}

/**
 * The text after the tier badge: "read 2 of 8 hunks · ~1 min (full read ~3 min)".
 * Like the inbox row, it leaves the reading estimate out when nothing needs reading.
 */
export function coverageLineText(decision: TierDecision): string {
  const reading = decision.readMinutes > 0 ? ` · ~${decision.readMinutes} min` : "";
  return `read ${decision.readHunks} of ${decision.totalHunks} hunks${reading} (full read ~${decision.fullMinutes} min)`;
}

/** The line under a collapsed covered section: "4 verified · 5 supported". */
export function coveredSummary(entries: HunkEntry[]): string {
  const count = (coverage: Coverage) => entries.filter((entry) => entry.coverage === coverage).length;
  return `${count("verified")} verified · ${count("supported")} supported`;
}

/** Raw unified text of a hunk, as `git diff` prints it; what Copy puts on the clipboard. */
export function hunkRawText(hunk: Hunk): string {
  const prefix = { context: " ", add: "+", del: "-" } as const;
  return [hunk.header, ...hunk.lines.map((line) => `${prefix[line.kind]}${line.text}`)].join("\n");
}

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
 * quote check's verdict. A failure matches on the item and the cited file,
 * side and lines; a citation the check never failed counts as found.
 * A failure with no citation (an unknown rule id) matches none.
 */
export function splitCitations(review: Review, itemId: string, citations: Citation[]): CheckedCitation[] {
  const failures = review.quoteCheck.failures.filter((failure) => failure.itemId === itemId);
  return citations.map((citation) => ({
    citation,
    isQuoteFound: !failures.some(({ citation: failed }) => failed !== null && isSameLocation(failed, citation)),
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

/** What the report-card alert says; the second sentence is the same for a missing and an unreadable card. */
export interface EvidenceAlert {
  title: string;
  /** "Run" or "Re-run", before the command. */
  verb: string;
  command: string;
  consequence: string;
}

/** The alert for a report card that is not readable, from the decision that applies without it. */
export function evidenceAlert(state: "missing" | "unreadable", decision: TierDecision): EvidenceAlert {
  return {
    title: state === "missing" ? "No report card yet" : "Couldn't read the report card",
    verb: state === "missing" ? "Run" : "Re-run",
    command: "pnpm evals",
    consequence: `Until then nothing counts as covered, so this change is Full: read ${decision.readHunks} of ${decision.totalHunks} hunks.`,
  };
}
