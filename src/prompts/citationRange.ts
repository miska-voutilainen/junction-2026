import type { Citation } from "../contracts";

/**
 * Longest cited range. Quotes are one to three lines, so a wide range only lets
 * any quote pass by sitting somewhere inside it, and would highlight a whole file.
 */
export const MAX_CITATION_LINES = 12;

/**
 * The reason a citation's line range is unusable, or null when it is fine. Shared
 * by A3 and A4 so every step caps ranges the same way as A2: a wide range lets any
 * quote pass by sitting somewhere inside it. The message goes back to the model on
 * the one retry.
 *
 * @example citationRangeProblem({ ...citation, startLine: 5, endLine: 40 }) // "citation lines 5-40 must be a range of 1 to 12 lines"
 */
export function citationRangeProblem(citation: Pick<Citation, "startLine" | "endLine">): string | null {
  const lines = citation.endLine - citation.startLine + 1;
  if (lines >= 1 && lines <= MAX_CITATION_LINES) return null;
  return `citation lines ${citation.startLine}-${citation.endLine} must be a range of 1 to ${MAX_CITATION_LINES} lines`;
}
