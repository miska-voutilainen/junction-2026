/**
 * Marks every line of the author's description with "| ", so a line in it that
 * reads "</author-description>" cannot close the block: no line of the text starts
 * a tag. Shared by A2 (anchored mode) and A4.
 *
 * @example prefixLines("Fixes the cap.\nAdds a test.") // "| Fixes the cap.\n| Adds a test."
 */
export function prefixLines(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => `| ${line}`)
    .join("\n");
}
