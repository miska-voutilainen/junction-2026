/**
 * The seven ideas Countersign puts forward, defined once. Every screen that
 * shows an idea labels it with `IdeaLabel`, which reads this list so the names
 * and numbers cannot drift apart. Spec section 1 (Emphasis) and section 3
 * (Idea labels).
 */

/** One of the seven ideas: its number and short name as shown in the label. */
export interface Idea {
  n: number;
  name: string;
}

export const IDEAS: readonly Idea[] = [
  { n: 1, name: "Trust ladder" },
  { n: 2, name: "Blind-first review" },
  { n: 3, name: "Hunk coverage map" },
  { n: 4, name: "Quote check" },
  { n: 5, name: "Refusal policy" },
  { n: 6, name: "Evidence levels" },
  { n: 7, name: "Signed receipt" },
];

// Until the idea pages exist (T25) every label opens the spec's screens section,
// which describes where each idea appears. Then this moves to docs/ideas/<page>.
export const IDEA_LINK_BASE =
  "https://github.com/miska-voutilainen/junction-2026/blob/main/docs/spec.md#3-screens";

/**
 * The page that explains idea `n`.
 *
 * @throws If `n` is not one of the seven ideas.
 * @example ideaUrl(3) // ".../docs/spec.md#3-screens"
 */
export function ideaUrl(n: number): string {
  if (!IDEAS.some((idea) => idea.n === n)) {
    throw new Error(`There is no idea ${n}. Ideas are numbered 1 to ${IDEAS.length}.`);
  }
  return IDEA_LINK_BASE;
}
