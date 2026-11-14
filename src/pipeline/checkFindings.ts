/**
 * Mechanical quote check for findings and refusals, and the refusals no model
 * is needed for. A finding the code cannot back is struck, not softened: it is
 * dropped from the review and recorded in `quoteCheck.failures`, so S2 shows
 * what the model said and why it didn't count. A refusal must name a rule that
 * exists in the policy. The fixed refusals (a change to the public API is always
 * the API owner's call) are added by path, whatever the model said. Spec section
 * 6, A3 and A4, and 9.1 T12 and T13.
 */
import type { Citation, Review } from "../contracts";
import { classifyFile } from "../policy/areas";
import { fixedRefusals, refusalRules } from "../policy/refusals";
import type { FindingDraft, RefusalDraft } from "../prompts/a3";
import type { Statement } from "../prompts/a4";
import { hunksMatchingGlob } from "../lib/git/hunksMatchingGlob";
import { checkCitation, type SideReader } from "./quoteCheck";

type Hunk = Review["hunks"][number];
type Claim = Review["claims"][number];
type Finding = Review["findings"][number];
type Refusal = Review["refusals"][number];
type QuoteCheck = Review["quoteCheck"];

/** A finding before the pipeline numbers it. */
export type UnnumberedFinding = Omit<Finding, "id">;

/** A refusal before the pipeline numbers it. */
export type UnnumberedRefusal = Omit<Refusal, "id">;

/** Where an unknown rule id is recorded: the rule list it should have been in. */
const refusalPolicyFile = "src/policy/refusals.ts";

/**
 * Keeps the citations that pass and records the rest in `quoteCheck`, which this
 * mutates the way `checkClaims` does. `itemId` names the model's item in the
 * failure list, e.g. "a3-f2" for the second finding A3 wrote.
 */
async function passingCitations(
  itemId: string,
  citations: readonly Citation[],
  readSide: SideReader,
  quoteCheck: QuoteCheck,
): Promise<Citation[]> {
  const passing: Citation[] = [];
  for (const citation of citations) {
    const result = await checkCitation(citation, readSide);
    quoteCheck.checked++;
    if (result.passed) {
      quoteCheck.passed++;
      passing.push(citation);
    } else {
      quoteCheck.failures.push({ itemId, citation, reason: result.reason });
    }
  }
  return passing;
}

/**
 * A3's findings after the quote check. One without a passing citation is dropped
 * and counted in `quoteCheck.dropped`.
 *
 * A finding's area is the area of the first citation that passes, by path (a
 * binding decision, spec section 6): the model chose areas inconsistently from
 * the checklists, and the path rule is the same one the trust ladder uses, so a
 * caught bug counts toward the area whose files it is in. Test, docs and
 * generated files have no area, so a finding that cites only them has none.
 */
export async function checkAreaFindings(
  drafts: readonly FindingDraft[],
  readSide: SideReader,
  quoteCheck: QuoteCheck,
): Promise<UnnumberedFinding[]> {
  const findings: UnnumberedFinding[] = [];
  for (const [index, draft] of drafts.entries()) {
    const citations = await passingCitations(`a3-f${index + 1}`, draft.citations, readSide, quoteCheck);
    if (citations.length === 0) {
      quoteCheck.dropped++;
      continue;
    }
    findings.push({
      kind: draft.kind,
      area: classifyFile(citations[0].file).area,
      severity: draft.severity,
      title: draft.title,
      detail: draft.detail,
      statement: null,
      hunkIds: draft.hunkIds,
      citations,
    });
  }
  return findings;
}

/**
 * A4's contradicted and unsupported statements as `contradiction` findings (area
 * null; high severity when contradicted, medium when unsupported). A contradicted
 * statement with no passing citation is dropped: a contradiction nobody can see
 * is a claim the reviewer can't check. An unsupported statement is kept without
 * one, because "nothing in the code shows this" has no line to quote.
 */
export async function checkContradictions(
  statements: readonly Statement[],
  claims: readonly Claim[],
  hunks: readonly Hunk[],
  readSide: SideReader,
  quoteCheck: QuoteCheck,
): Promise<UnnumberedFinding[]> {
  const findings: UnnumberedFinding[] = [];
  for (const [index, statement] of statements.entries()) {
    if (statement.verdict === "supported") continue;
    const citations = await passingCitations(`a4-s${index + 1}`, statement.citations, readSide, quoteCheck);
    if (statement.verdict === "contradicted" && citations.length === 0) {
      quoteCheck.dropped++;
      continue;
    }
    findings.push({
      kind: "contradiction",
      area: null,
      severity: statement.verdict === "contradicted" ? "high" : "medium",
      title: statement.verdict === "contradicted" ? "The code contradicts the description" : "The description is not backed by the code",
      detail: statement.explanation,
      statement: statement.statement,
      hunkIds: hunksOfStatement(statement, citations, claims, hunks),
      citations,
    });
  }
  return findings;
}

/**
 * The hunks of the claims A4 relied on plus the hunks its citations fall in on
 * the new side, so route() sends a contradiction's code to a reader.
 */
function hunksOfStatement(
  statement: Statement,
  citations: readonly Citation[],
  claims: readonly Claim[],
  hunks: readonly Hunk[],
): string[] {
  const ids = new Set<string>(
    claims.filter((claim) => statement.claimIds.includes(claim.id)).flatMap((claim) => claim.hunkIds),
  );
  for (const citation of citations) {
    for (const hunk of hunks) {
      const overlaps =
        hunk.file === citation.file &&
        citation.side === "new" &&
        citation.startLine < hunk.newStart + hunk.newLines &&
        citation.endLine >= hunk.newStart;
      if (overlaps) ids.add(hunk.id);
    }
  }
  return [...ids];
}

/**
 * The model's refusals whose rule id exists in the policy. An unknown id is
 * dropped and recorded with the reason "unknown rule id": a refusal must point at
 * words a person can read in the policy.
 */
export function checkRefusals(
  drafts: readonly RefusalDraft[],
  quoteCheck: QuoteCheck,
): UnnumberedRefusal[] {
  const knownRuleIds = new Set(refusalRules.map((rule) => rule.id));
  const refusals: UnnumberedRefusal[] = [];
  for (const [index, draft] of drafts.entries()) {
    if (!knownRuleIds.has(draft.ruleId)) {
      quoteCheck.failures.push({
        itemId: `a3-r${index + 1}`,
        citation: { file: refusalPolicyFile, side: "new", startLine: 1, endLine: 1, quote: draft.ruleId },
        reason: "unknown rule id",
      });
      continue;
    }
    refusals.push({ ruleId: draft.ruleId, source: "ai", reason: draft.reason, hunkIds: draft.hunkIds });
  }
  return refusals;
}

/** One `source: "rule"` refusal per fixed trigger that matches a hunk, with those hunks. */
export function fixedRefusalsFor(hunks: readonly Hunk[]): UnnumberedRefusal[] {
  return fixedRefusals.flatMap((fixed) => {
    const matched = hunksMatchingGlob(fixed.glob, hunks);
    if (matched.length === 0) return [];
    return [{ ruleId: fixed.ruleId, source: "rule" as const, reason: fixed.reason, hunkIds: matched.map((hunk) => hunk.id) }];
  });
}
