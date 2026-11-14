/**
 * Mechanical quote check: the model only gets to call a claim Supported if the
 * code it quotes is really on the lines it cites. Plain string comparison, no
 * model, so a made-up quote is caught the same way every time and the failure is
 * recorded where a reviewer can read it. The idea is borrowed from courts, which
 * admit expert testimony only when its basis can be checked. Spec section 6, A2,
 * and 9.1 T12.
 */
import type { Citation, Review } from "../contracts";
import type { ClaimDraft } from "../prompts/a2";
import { hunksMatchingGlob } from "../lib/git/hunksMatchingGlob";

type Hunk = Review["hunks"][number];
type Claim = Review["claims"][number];
type QuoteCheck = Review["quoteCheck"];

/** Returns a file's text on one side of the diff, or null when the file isn't there. */
export type SideReader = (side: Citation["side"], file: string) => Promise<string | null>;

/** A claim as drafted by A2, with the id the pipeline gave it in output order. */
export type IdentifiedClaimDraft = ClaimDraft & { id: string };

/** The claims after the check and the counts that go in `Review.quoteCheck`. */
export interface CheckedClaims {
  claims: Claim[];
  quoteCheck: QuoteCheck;
  /** Hunk ids the model listed on a supported claim without a passing citation inside them. The Review contract has no field for it. */
  hunkIdsRemoved: number;
}

/**
 * Collapses every whitespace run (newlines included) to one space and trims.
 * The model often re-indents or re-wraps what it quotes; an exact comparison
 * would call those quotes invented when they are not. Case still matters.
 */
export function normalizeWhitespace(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\s+/g, " ").trim();
}

/** Outcome of one citation: passed, or the reason it failed. */
export type CitationResult = { passed: true } | { passed: false; reason: string };

/**
 * Checks one citation: its normalised quote must be a substring of the normalised
 * text of lines startLine to endLine of the cited side.
 */
export async function checkCitation(
  citation: Citation,
  readSide: SideReader,
): Promise<CitationResult> {
  const text = await readSide(citation.side, citation.file);
  if (text === null) return { passed: false, reason: `file not present on ${citation.side}` };

  const quote = normalizeWhitespace(citation.quote);
  if (quote === "") return { passed: false, reason: "empty quote" };

  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const cited = normalizeWhitespace(
    lines.slice(citation.startLine - 1, citation.endLine).join("\n"),
  );
  if (cited.includes(quote)) return { passed: true };
  return {
    passed: false,
    reason: `quote not found in lines ${citation.startLine}–${citation.endLine} of the ${citation.side} file`,
  };
}

/**
 * Runs the check over A2's claims. A claim with at least one passing citation is
 * supported and keeps only the passing citations; any other claim becomes
 * unverified with no citations. Claims are never dropped: the reviewer sees what
 * the model said and that nothing backed it.
 *
 * A supported claim also keeps only the hunks a passing citation lies in: a claim
 * that lists three hunks but quotes code from one has shown evidence for one.
 */
export async function checkClaims(
  drafts: readonly IdentifiedClaimDraft[],
  hunks: readonly Hunk[],
  readSide: SideReader,
): Promise<CheckedClaims> {
  const quoteCheck: QuoteCheck = { checked: 0, passed: 0, downgraded: 0, dropped: 0, failures: [] };
  const claims: Claim[] = [];
  let hunkIdsRemoved = 0;
  for (const draft of drafts) {
    const checked = await checkClaim(draft, hunks, readSide, quoteCheck);
    hunkIdsRemoved += checked.hunkIdsRemoved;
    claims.push(checked.claim);
  }
  return { claims, quoteCheck, hunkIdsRemoved };
}

async function checkClaim(
  draft: IdentifiedClaimDraft,
  hunks: readonly Hunk[],
  readSide: SideReader,
  quoteCheck: QuoteCheck,
): Promise<{ claim: Claim; hunkIdsRemoved: number }> {
  // A pathGlob claim covers every matching hunk and ignores the hunkIds the model wrote.
  const expanded = draft.pathGlob === null ? null : hunksMatchingGlob(draft.pathGlob, hunks);

  const passing: Citation[] = [];
  let isFirstCitationPassing = false;
  for (const [index, citation] of draft.citations.entries()) {
    let result = await checkCitation(citation, readSide);
    // The first quote stands for every globbed hunk, so it must be in the added lines
    // of each, whatever the other citations show.
    if (result.passed && index === 0 && expanded !== null) {
      const missingFrom = expanded.filter((hunk) => !isInAddedLines(citation.quote, hunk));
      if (missingFrom.length > 0) {
        result = {
          passed: false,
          reason: `quote not in the added lines of ${missingFrom.map((hunk) => hunk.id).join(", ")}`,
        };
      }
    }
    quoteCheck.checked++;
    if (result.passed) {
      quoteCheck.passed++;
      passing.push(citation);
      if (index === 0) isFirstCitationPassing = true;
    } else {
      quoteCheck.failures.push({ itemId: draft.id, citation, reason: result.reason });
    }
  }

  const isSupported = passing.length > 0 && (expanded === null || isFirstCitationPassing);
  if (!isSupported) quoteCheck.downgraded++;

  const listed = expanded === null ? draft.hunkIds : expanded.map((hunk) => hunk.id);
  const hunkIds =
    isSupported && expanded === null
      ? listed.filter((id) =>
          isHunkCited(
            hunks.find((hunk) => hunk.id === id),
            passing,
          ),
        )
      : listed;
  return {
    claim: {
      id: draft.id,
      requirementItemId: draft.requirementItemId,
      text: draft.text,
      kind: draft.kind,
      level: isSupported ? "supported" : "unverified",
      hunkIds,
      citations: isSupported ? passing : [],
      evidence: isSupported ? [quoteCheckEvidence(passing[0])] : [],
    },
    hunkIdsRemoved: isSupported ? listed.length - hunkIds.length : 0,
  };
}

/** True when a passing citation names the hunk's file and its lines overlap the hunk's lines on the cited side. */
function isHunkCited(hunk: Hunk | undefined, passing: readonly Citation[]): boolean {
  if (hunk === undefined) return false;
  const start = (side: Citation["side"]) => (side === "new" ? hunk.newStart : hunk.oldStart);
  const length = (side: Citation["side"]) => (side === "new" ? hunk.newLines : hunk.oldLines);
  return passing.some(
    (citation) =>
      citation.file === hunk.file &&
      citation.startLine <= start(citation.side) + length(citation.side) - 1 &&
      citation.endLine >= start(citation.side),
  );
}

/**
 * True when the quote sits inside one contiguous run of added lines. Runs are
 * joined separately: a quote that jumps over an unchanged or removed line was
 * never added as written.
 */
function isInAddedLines(quote: string, hunk: Hunk): boolean {
  const wanted = normalizeWhitespace(quote);
  const runs: string[][] = [];
  let previousWasAdded = false;
  for (const line of hunk.lines) {
    if (line.kind !== "add") {
      previousWasAdded = false;
      continue;
    }
    if (previousWasAdded) runs[runs.length - 1].push(line.text);
    else runs.push([line.text]);
    previousWasAdded = true;
  }
  return runs.some((run) => normalizeWhitespace(run.join("\n")).includes(wanted));
}

function quoteCheckEvidence(citation: Citation): Claim["evidence"][number] {
  return {
    kind: "quote-check",
    summary: `Quote checked against the code at ${citation.file}:${citation.startLine}–${citation.endLine}`,
    testName: null,
    base: null,
    head: null,
  };
}
