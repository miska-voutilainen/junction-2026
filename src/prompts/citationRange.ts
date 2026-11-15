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
 * The message counts the lines and gives a range that fits: the model's usual
 * mistake is one line too many (start + 12, counting only one end), and a bare
 * "must be 1 to 12 lines" let it repeat the same range on the retry.
 *
 * @example citationRangeProblem({ ...citation, startLine: 1014, endLine: 1026 })
 * // "citation lines 1014-1026 are 13 lines (both ends count); the range must be 1 to 12 lines, for example 1014-1025"
 */
export function citationRangeProblem(
  citation: Pick<Citation, "startLine" | "endLine">,
): string | null {
  const { startLine, endLine } = citation;
  const lines = endLine - startLine + 1;
  if (lines >= 1 && lines <= MAX_CITATION_LINES) return null;
  if (lines < 1)
    return `citation lines ${startLine}-${endLine} run backwards; startLine must not be after endLine`;
  return `citation lines ${startLine}-${endLine} are ${lines} lines (both ends count); the range must be 1 to ${MAX_CITATION_LINES} lines, for example ${startLine}-${startLine + MAX_CITATION_LINES - 1}`;
}
