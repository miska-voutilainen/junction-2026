/**
 * "1 claim", "2 claims": the count with its noun, singular only for exactly one.
 * Pass the plural form when adding "s" is wrong, e.g. `countOf(2, "entry", "entries")`.
 */
export function countOf(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
