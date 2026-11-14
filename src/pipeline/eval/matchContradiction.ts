/**
 * Blind-first review, measured: a run catches a planted false sentence in the
 * PR description when A4 marks that sentence as a contradiction. The report
 * card counts this over anchored and blind-first runs to show what reading the
 * code before the description buys. Spec section 6 (A4) and 9.1 (T16).
 */
import type { AnswerKey, Review } from "@/contracts";
import { tokenOverlap } from "./tokenOverlap";

type Finding = Review["findings"][number];

/**
 * Smallest share of the planted sentence's words the finding's statement must
 * contain. The model paraphrases or trims the sentence it quotes; 0.8 of the
 * key's words still pins the same sentence and rejects its neighbours.
 */
export const STATEMENT_TOKEN_OVERLAP_MIN = 0.8;

/** True when the statement is the plant sentence (ignoring case and spacing) or covers enough of its words. */
export function statementMatches(statement: string, plantSentence: string): boolean {
  if (normalise(statement) === normalise(plantSentence)) return true;
  return tokenOverlap(plantSentence, statement) >= STATEMENT_TOKEN_OVERLAP_MIN;
}

/** The first contradiction finding whose statement matches the key's false sentence; null for other key kinds. */
export function findContradictionMatch(
  findings: readonly Finding[],
  key: AnswerKey,
): Finding | null {
  if (key.kind !== "contradiction") return null;
  const match = findings.find(
    (finding) =>
      finding.kind === "contradiction" &&
      finding.statement !== null &&
      statementMatches(finding.statement, key.defect),
  );
  return match ?? null;
}

function normalise(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, " ");
}
