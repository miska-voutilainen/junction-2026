/**
 * The eight ideas Countersign puts forward, defined once. Every screen that
 * shows an idea labels it with `IdeaLabel`, which reads this list so the names,
 * numbers and pages cannot drift apart. Names are the short form of the table
 * in spec section 1 (Emphasis); pages are the files in `docs/ideas/`. Spec
 * section 3 (Idea labels).
 */

/** The number of one of the eight ideas. */
export type IdeaNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/** One idea: its number, the name shown in the label and its page in `docs/ideas/`. */
export interface Idea {
  n: IdeaNumber;
  name: string;
  page: string;
}

export const IDEAS: readonly Idea[] = [
  { n: 1, name: "Trust ladder", page: "trust-ladder.md" },
  { n: 2, name: "Blind-first review", page: "blind-first.md" },
  { n: 3, name: "Hunk coverage map", page: "coverage-map.md" },
  { n: 4, name: "Quote check", page: "quote-check.md" },
  { n: 5, name: "Refusal policy", page: "refusal-policy.md" },
  { n: 6, name: "Evidence levels", page: "evidence-levels.md" },
  { n: 7, name: "Signed receipt", page: "signed-receipt.md" },
  { n: 8, name: "The author never checks its own work", page: "separation-of-duties.md" },
];

/** Where files of this repository are shown on GitHub, for links to docs. */
export const REPO_BLOB_URL = "https://github.com/miska-voutilainen/junction-2026/blob/main";

/** Where the idea pages live on GitHub. */
export const IDEA_PAGES_URL = `${REPO_BLOB_URL}/docs/ideas`;

/**
 * The page that explains idea `n`.
 *
 * @example ideaUrl(8) // ".../docs/ideas/separation-of-duties.md"
 */
export function ideaUrl(n: IdeaNumber): string {
  const idea = IDEAS.find((candidate) => candidate.n === n);
  return `${IDEA_PAGES_URL}/${idea?.page}`;
}
