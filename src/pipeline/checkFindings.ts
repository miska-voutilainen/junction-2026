/**
 * Mechanical quote check for findings and refusals, and the refusals no model
 * is needed for. An area finding the code cannot back is struck, not softened: it is
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
import { checkCitation, isHunkCited, type SideReader } from "./quoteCheck";

type Hunk = Review["hunks"][number];
type Claim = Review["claims"][number];
type Finding = Review["findings"][number];
type Refusal = Review["refusals"][number];
type QuoteCheck = Review["quoteCheck"];

/** A finding before the pipeline numbers it. */
export type UnnumberedFinding = Omit<Finding, "id">;

/** A refusal before the pipeline numbers it. */
export type UnnumberedRefusal = Omit<Refusal, "id">;

/**
 * Keeps the citations that pass and records the rest in `quoteCheck`, which this
 * mutates the way `checkClaims` does. `itemId` names the model's item in the
 * failure list, e.g. "a3-f2" for the second finding A3 wrote (see the contract).
 */
async function passingCitations(
  itemId: string,
  citations: readonly Citation[],
  readSide: SideReader,
  quoteCheck: QuoteCheck,
): Promise<Citation[]> {
  // The checks read files and do not depend on each other, so they run together;
  // the counts and failures are recorded afterwards in citation order.
  const results = await Promise.all(citations.map((citation) => checkCitation(citation, readSide)));
  const passing: Citation[] = [];
  for (const [index, citation] of citations.entries()) {
    const result = results[index];
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
 * caught bug counts toward the area whose files it is in. Test and
 * generated files, and Markdown outside doc/analyzers/, have no area, so a
 * finding that cites only them has none.
 */
export async function checkAreaFindings(
  drafts: readonly FindingDraft[],
  readSide: SideReader,
  quoteCheck: QuoteCheck,
): Promise<UnnumberedFinding[]> {
  const findings: UnnumberedFinding[] = [];
  // One finding at a time: failures are listed in the order the model wrote the findings.
  for (const [index, draft] of drafts.entries()) {
    const citations = await passingCitations(
      `a3-f${index + 1}`,
      draft.citations,
      readSide,
      quoteCheck,
    );
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
 * null; high severity when contradicted, medium when unsupported). Never dropped,
 * whatever the quote check says: the contradiction is between the author's
 * sentence and the claims, so it stands without a quote. Citations that fail are
 * removed from the finding and stay recorded in `quoteCheck.failures`.
 */
export async function checkContradictions(
  statements: readonly Statement[],
  claims: readonly Claim[],
  hunks: readonly Hunk[],
  readSide: SideReader,
  quoteCheck: QuoteCheck,
): Promise<UnnumberedFinding[]> {
  const findings: UnnumberedFinding[] = [];
  // One statement at a time: failures are listed in the order the model wrote the statements.
  for (const [index, statement] of statements.entries()) {
    if (statement.verdict === "supported") continue;
    const citations = await passingCitations(
      `a4-s${index + 1}`,
      statement.citations,
      readSide,
      quoteCheck,
    );
    findings.push({
      kind: "contradiction",
      area: null,
      severity: statement.verdict === "contradicted" ? "high" : "medium",
      title:
        statement.verdict === "contradicted"
          ? "The code contradicts the description"
          : "The description is not backed by the code",
      detail: statement.explanation,
      statement: statement.statement,
      hunkIds: hunksOfStatement(statement, citations, claims, hunks),
      citations,
    });
  }
  return findings;
}

/**
 * The hunks of the claims A4 relied on plus the hunks its citations fall in, on
 * either side, so route() sends a contradiction's code to a reader.
 */
function hunksOfStatement(
  statement: Statement,
  citations: readonly Citation[],
  claims: readonly Claim[],
  hunks: readonly Hunk[],
): string[] {
  const ids = new Set<string>(
    claims
      .filter((claim) => statement.claimIds.includes(claim.id))
      .flatMap((claim) => claim.hunkIds),
  );
  for (const hunk of hunks) if (isHunkCited(hunk, citations)) ids.add(hunk.id);
  return [...ids];
}

/**
 * The model's refusals whose rule id exists in the policy. An unknown id is
 * dropped and recorded with a null citation (there is no code to check) and the
 * reason `unknown rule id "R8"`: a refusal must point at words a person can read
 * in the policy.
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
        citation: null,
        reason: `unknown rule id "${draft.ruleId}"`,
      });
      continue;
    }
    refusals.push({
      ruleId: draft.ruleId,
      source: "ai",
      reason: draft.reason,
      hunkIds: draft.hunkIds,
    });
  }
  return refusals;
}

/** One `source: "rule"` refusal per fixed trigger that matches a hunk, with those hunks. */
export function fixedRefusalsFor(hunks: readonly Hunk[]): UnnumberedRefusal[] {
  return fixedRefusals.flatMap((fixed) => {
    const matched = hunksMatchingGlob(fixed.glob, hunks);
    if (matched.length === 0) return [];
    return [
      {
        ruleId: fixed.ruleId,
        source: "rule" as const,
        reason: fixed.reason,
        hunkIds: matched.map((hunk) => hunk.id),
      },
    ];
  });
}

/**
 * The AI's refusals plus the fixed ones, without counting one decision twice:
 * a rule refusal is added only for the matched hunks no AI refusal with the
 * same rule id already lists (spec section 5, Policy). An AI R7 on the hunk a
 * fixed R7 matches already makes the person decide it.
 */
export function mergeFixedRefusals(
  aiRefusals: readonly UnnumberedRefusal[],
  fixedRefusals: readonly UnnumberedRefusal[],
): UnnumberedRefusal[] {
  const addedFixed = fixedRefusals.flatMap((fixed) => {
    const listed = new Set(
      aiRefusals
        .filter((refusal) => refusal.ruleId === fixed.ruleId)
        .flatMap((refusal) => refusal.hunkIds),
    );
    const hunkIds = fixed.hunkIds.filter((id) => !listed.has(id));
    return hunkIds.length === 0 ? [] : [{ ...fixed, hunkIds }];
  });
  return [...aiRefusals, ...addedFixed];
}
