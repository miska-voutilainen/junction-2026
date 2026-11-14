/**
 * The review page as data: which hunks the human reads, which are covered by
 * evidence and why, in the order the navigator and the diff both show them.
 * The coverage itself comes from `route()` (hunk coverage map, spec section
 * 5); this file only arranges it. Pure functions, no React.
 */
import { tierLabel } from "@/contracts";
import type { Area, Citation, Coverage, LadderLevel, ReportCard, Review, TierDecision } from "@/contracts";
import { applyEscapes, levelsFromReportCard } from "@/rules/ladder";
import { route } from "@/rules/route";

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

/** New-side line range of a hunk: "737–745", or the start alone for a hunk that only deletes. */
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
    if (!file) continue;
    const coverage = decision.coverage[hunk.id];
    const entry: HunkEntry = {
      hunk,
      file,
      coverage,
      range: hunkRange(hunk),
      evidence: evidenceLine(review, hunk, coverage, file.area ? levels[file.area] : null),
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
export function evidenceLine(review: Review, hunk: Hunk, coverage: Coverage, areaLevel: LadderLevel | null): string {
  if (coverage === "read") return readReason(review, hunk, areaLevel);
  const claims = review.claims.filter((claim) => claim.hunkIds.includes(hunk.id) && claim.level === coverage);
  if (coverage === "verified") {
    const testName = claims.flatMap((claim) => claim.evidence).find((item) => item.testName !== null)?.testName;
    return testName ? `Test passes on this change: ${testName}` : "Verified by a test on this change";
  }
  const citation = claims.flatMap((claim) => claim.citations)[0];
  if (citation) return `Quote checked: ${fileName(citation.file)}:${citation.startLine}`;
  const summary = claims.flatMap((claim) => claim.evidence)[0]?.summary;
  return summary ?? "Supported by a checked quote";
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

/** The text after the tier badge: "read 2 of 8 hunks · ~1 min (full read ~3 min)". */
export function coverageLineText(decision: TierDecision): string {
  return `read ${decision.readHunks} of ${decision.totalHunks} hunks · ~${decision.readMinutes} min (full read ~${decision.fullMinutes} min)`;
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

/** Trust levels with every area at Shadow, for when the report card can't be read. */
export function shadowLevels(): Record<Area, LadderLevel> {
  return levelsFromReportCard(null);
}

/**
 * The decision when the report card is unavailable. Without a track record
 * nothing counts as covered, so every hunk is "read" and the tier is Full.
 * The reasons are those of `route()` with every area at Shadow.
 */
export function decisionWithoutEvidence(review: Review): TierDecision {
  const shadow = route(review, shadowLevels());
  const coverage = Object.fromEntries(review.hunks.map((hunk) => [hunk.id, "read" as const]));
  return {
    ...shadow,
    tier: "full",
    coverage,
    readHunks: shadow.totalHunks,
    readLines: shadow.totalLines,
    readMinutes: shadow.fullMinutes,
  };
}

/** The alert text for the evidence-unavailable state, from the fallback decision. */
export function evidenceUnavailableText(decision: TierDecision): string {
  return `Without a track record nothing counts as covered, so this change is now ${tierLabel[decision.tier]}: read ${decision.readHunks} of ${decision.totalHunks} hunks.`;
}

/** How a review is routed right now: the decision, the trust levels behind it, and whether the report card was there. */
export interface ReviewDecision {
  decision: TierDecision;
  levels: Record<Area, LadderLevel>;
  isEvidenceAvailable: boolean;
}

/**
 * Routes the review with the report card's levels minus simulated escapes, so
 * a recorded escape changes the tier on this page without a reload. With no
 * readable report card the fallback applies (`decisionWithoutEvidence`).
 *
 * @param reportCard null when the file is missing or unreadable
 */
export function decideReview(review: Review, reportCard: ReportCard | null, escapes: Partial<Record<Area, number>>): ReviewDecision {
  if (reportCard === null) {
    return { decision: decisionWithoutEvidence(review), levels: shadowLevels(), isEvidenceAvailable: false };
  }
  const levels = applyEscapes(levelsFromReportCard(reportCard), escapes);
  return { decision: route(review, levels), levels, isEvidenceAvailable: true };
}
