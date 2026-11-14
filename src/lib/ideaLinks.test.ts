import { describe, expect, it } from "vitest";
import { IDEAS, IDEA_PAGES_URL, ideaUrl } from "./ideaLinks";

describe("ideaLinks", () => {
  it("defines nine ideas numbered 1 to 9", () => {
    expect(Object.values(IDEAS).map((idea) => idea.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("links every idea to its own page in docs/ideas", () => {
    const urls = Object.values(IDEAS).map((idea) => ideaUrl(idea.n));
    expect(new Set(urls).size).toBe(9);
    expect(ideaUrl(8)).toBe(`${IDEA_PAGES_URL}/separation-of-duties.md`);
  });
});
