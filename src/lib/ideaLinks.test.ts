import { describe, expect, it } from "vitest";
import { IDEAS, IDEA_LINK_BASE, ideaUrl } from "./ideaLinks";

describe("ideaLinks", () => {
  it("defines seven ideas numbered 1 to 7", () => {
    expect(IDEAS.map((idea) => idea.n)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("links every idea to the base page", () => {
    for (const { n } of IDEAS) expect(ideaUrl(n)).toBe(IDEA_LINK_BASE);
  });

  it("rejects a number that is not an idea", () => {
    expect(() => ideaUrl(8)).toThrow("There is no idea 8");
  });
});
