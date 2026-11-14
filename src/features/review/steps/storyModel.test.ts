// @vitest-environment node
import { describe, expect, it } from "vitest";
import { loadFixtureReview } from "./stepsModelFixtures";
import { buildStory, citationLabel } from "./storyModel";

describe("story", () => {
  it("groups claims by requirement item in the requirement's order, untraced claims last", async () => {
    const review = await loadFixtureReview("mp-2283");
    const headings = buildStory(review).groups.map((group) => group.heading.split(" · ")[0]);
    expect(headings).toEqual(["F1", "F2", "F3", "N1", "N2"]);

    const untraced = structuredClone(review);
    untraced.claims[0].requirementItemId = null;
    expect(buildStory(untraced).groups.at(-1)?.heading).toBe("Not traced to a requirement item");
  });

  it("pairs a retracted claim with its retraction and leaves the others alone", async () => {
    const claims = buildStory(await loadFixtureReview("mp-2283")).groups.flatMap((group) => group.claims);
    const retracted = claims.filter((entry) => entry.retraction !== null);
    expect(retracted.map((entry) => entry.claim.id)).toEqual(["c8"]);
    expect(claims).toHaveLength(8);
  });

  it("never turns a quote-check failure into a claim", async () => {
    const review = await loadFixtureReview("mp-2283");
    const story = buildStory(review);
    expect(story.groups.flatMap((group) => group.claims)).toHaveLength(review.claims.length);
    expect(story.quoteCheckLine).toBe("Quote check: 9 of 10 quotes found in the code, 1 claim downgraded.");
  });
});

describe("quote check", () => {
  it("marks a citation the quote check failed, and leaves the rest found", async () => {
    const review = structuredClone(await loadFixtureReview("mp-2283"));
    const failure = review.quoteCheck.failures[0];
    const claim = review.claims.find((candidate) => candidate.id === failure.itemId);
    if (!claim) throw new Error("fixture claim missing");
    if (!failure.citation) throw new Error("fixture failure has no citation");
    const other = { ...failure.citation, startLine: 10, endLine: 11 };
    claim.citations = [failure.citation, other];

    const entry = buildStory(review)
      .groups.flatMap((group) => group.claims)
      .find((candidate) => candidate.claim.id === claim.id);
    expect(entry?.citations.map((citation) => citation.isQuoteFound)).toEqual([false, true]);
  });

  it("counts downgraded claims and dropped findings apart", async () => {
    const review = structuredClone(await loadFixtureReview("mp-2283"));
    review.quoteCheck = { ...review.quoteCheck, downgraded: 1, dropped: 2 };
    expect(buildStory(review).quoteCheckLine).toBe("Quote check: 9 of 10 quotes found in the code, 1 claim downgraded, 2 findings dropped.");
  });
});

describe("citation label", () => {
  it("writes a citation as file:line, collapsing a one-line range", () => {
    const citation = { file: "src/a/Foo.cs", side: "new" as const, startLine: 10, endLine: 12, quote: "" };
    expect(citationLabel(citation)).toBe("Foo.cs:10–12");
    expect(citationLabel({ ...citation, endLine: 10 })).toBe("Foo.cs:10");
  });
});
