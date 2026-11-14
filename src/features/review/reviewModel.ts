/**
 * The review page as data: which hunks the human reads, which are covered by
 * evidence and why, in the order the navigator and the diff both show them.
 * The coverage itself comes from `route()` (hunk coverage map, spec section
 * 5); this file only arranges it. Pure functions, no React.
 */
import type { Area, Citation, Coverage, LadderLevel, Review, TierDecision } from "@/contracts";
import { coverageLabel } from "@/contracts";
import { countGenerated } from "@/rules/route";
import { isLineHighlighted } from "./citationHighlights";

// The steps model still imports these from here.
export { splitCitations } from "./citationHighlights";
export type { CheckedCitation } from "./citationHighlights";

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
  /** Hunks route() marked "generated"; shown collapsed as snapshot files, outside the reading count. */
  generated: HunkEntry[];
}

/** One line of the navigator: a hunk, or all covered generated files of a group as one item. */
export interface NavigatorItem {
  /** The hunk to scroll to; for the generated item, the first generated hunk of the group. */
  hunkId: string;
  /** The file name without folders (`TypeCollector.cs`); the generated item's own text. */
  fileName: string;
  /** The full text, also the dropdown option: `TypeCollector.cs:236–242`. */
  label: string;
  /** The line range alone (`236–242`), kept whole when the file name truncates; null for the generated item. */
  lineRange: string | null;
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

/** The order coverage groups are listed in on the review page and the receipt: what a person must read first, generated last. */
export const COVERAGE_READING_ORDER: Coverage[] = ["read", "supported", "verified", "generated"];

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
 * what evidence covers and the generated hunks.
 *
 * A generated file's hunk only collapses when route() marks it "generated": one
 * a finding or refusal names comes back as "read", so it stays in `read`.
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
    else if (coverage === "generated") sections.generated.push(entry);
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
  // The generated section title says why these hunks are outside the count, so a row repeats nothing.
  if (coverage === "generated") return "";
  if (coverage === "read") return readReason(review, hunk, areaLevel);
  const claims = claimsAtLevel(review, hunk, coverage);
  // route() only marks a hunk verified or supported when a claim at that level names it.
  if (claims.length === 0) {
    throw new Error(`Review ${review.changeId} marks hunk ${hunk.id} ${coverage}, but no ${coverage} claim names it. Re-record it with pnpm review run ${review.changeId}.`);
  }
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
  return `Verified by claim ${claims[0].id}: ${claims[0].text}`;
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
  const outside = claim.citations[0];
  if (outside) return `Supported by ${claim.id} · quote checked at ${fileName(outside.file)}:${outside.startLine}, outside this hunk`;
  return `Supported by ${claim.id}: ${claim.evidence[0]?.summary ?? claim.text}`;
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
 * The navigator's groups: "Read this", "Supported", "Verified", "Generated",
 * empty ones omitted. Generated hunks become one item, "<n> generated snapshot
 * files", so a snapshot-heavy change doesn't drown the list.
 */
export function buildNavigator(sections: HunkSections): NavigatorGroup[] {
  const groups: NavigatorGroup[] = [];
  for (const coverage of COVERAGE_READING_ORDER) {
    const hunkEntries = [...sections.read, ...sections.covered].filter((entry) => entry.coverage === coverage);
    const generated = coverage === "generated" ? sections.generated : [];
    const items: NavigatorItem[] = hunkEntries.map((entry) => ({
      hunkId: entry.hunk.id,
      fileName: fileName(entry.hunk.file),
      label: `${fileName(entry.hunk.file)}:${entry.range}`,
      lineRange: entry.range,
      coverage,
      area: entry.file.area,
      isGenerated: false,
    }));
    if (generated.length > 0) {
      const fileCount = new Set(generated.map((entry) => entry.hunk.file)).size;
      items.push({
        hunkId: generated[0].hunk.id,
        fileName: `${fileCount} generated snapshot ${fileCount === 1 ? "file" : "files"}`,
        label: `${fileCount} generated snapshot ${fileCount === 1 ? "file" : "files"}`,
        lineRange: null,
        coverage,
        area: null,
        isGenerated: true,
      });
    }
    if (items.length === 0) continue;
    groups.push({ coverage, title: coverageLabel[coverage], hunkCount: hunkEntries.length + generated.length, items });
  }
  return groups;
}

/**
 * The text after the tier badge: "read 2 of 8 hunks · ~1 min (full read ~3 min)".
 * Like the inbox row, it leaves the reading estimate out when nothing needs reading,
 * and names the generated hunks when the count leaves some out: "read 12 of 423 hunks · 411 generated".
 * The full-read time is left out when it equals the reading time: two equal numbers compare nothing.
 */
export function coverageLineText(decision: TierDecision): string {
  const generated = countGenerated(decision.coverage);
  const generatedNote = generated > 0 ? ` · ${generated} generated` : "";
  const reading = decision.readMinutes > 0 ? ` · ~${decision.readMinutes} min` : "";
  const fullRead = decision.fullMinutes === decision.readMinutes ? "" : ` (full read ~${decision.fullMinutes} min)`;
  return `read ${decision.readHunks} of ${decision.totalHunks} hunks${generatedNote}${reading}${fullRead}`;
}

/** The line under a collapsed covered section: "4 verified · 5 supported", a zero part left out. */
export function coveredSummary(entries: HunkEntry[]): string {
  const count = (coverage: Coverage) => entries.filter((entry) => entry.coverage === coverage).length;
  return [`${count("verified")} verified`, `${count("supported")} supported`].filter((part) => !part.startsWith("0 ")).join(" · ");
}

/** Raw unified text of a hunk, as `git diff` prints it; what Copy puts on the clipboard. */
export function hunkRawText(hunk: Hunk): string {
  const prefix = { context: " ", add: "+", del: "-" } as const;
  return [hunk.header, ...hunk.lines.map((line) => `${prefix[line.kind]}${line.text}`)].join("\n");
}
