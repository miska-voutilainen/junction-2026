import { describe, expect, it } from "vitest";
import type { Review } from "../contracts";
import { checkReview } from "./checkReview";

const requirement = {
  id: "MP-2283",
  title: "t",
  intent: "i",
  functional: [
    { id: "F1", text: "a" },
    { id: "F2", text: "b" },
  ],
  nonFunctional: [{ id: "N1", text: "c" }],
  derivedFrom: { kind: "github-issue" as const, url: "u", note: "n" },
};

function item(requirementItemId: string, behaviour = "Builds cleanly.") {
  return { requirementItemId, expectedBehaviours: [behaviour], likelyAreas: [], expectedTests: [] };
}

function hunk(id: string, file: string) {
  return { id, file, header: "@@", oldStart: 1, oldLines: 1, newStart: 1, newLines: 1, lines: [] };
}

function reviewWith(overrides: Partial<Review>): Review {
  return {
    changeId: "mp-2283",
    requirement,
    expectation: {
      items: [
        item("F1", "The generator does not throw"),
        item("F2", "A resolver is generated"),
        item("N1"),
      ],
    },
    files: [
      { path: "src/A.cs", kind: "source", area: null, added: 1, removed: 0, hunkIds: ["h1"] },
      { path: "README.md", kind: "docs", area: null, added: 1, removed: 0, hunkIds: ["h2"] },
    ],
    hunks: [hunk("h1", "src/A.cs"), hunk("h2", "README.md")],
    claims: [{ id: "c1", hunkIds: ["h1"] }],
    ...overrides,
  } as unknown as Review;
}

const outcome = (review: Review) =>
  Object.fromEntries(checkReview(review).map((result) => [result.name, result.passed]));

describe("checkReview", () => {
  it("passes a review that covers items, mentions the crash and resolver, and claims every code hunk", () => {
    expect(Object.values(outcome(reviewWith({}))).every(Boolean)).toBe(true);
    expect(checkReview(reviewWith({}))).toHaveLength(4);
  });

  it("misses when an item is absent or repeated", () => {
    const missing = reviewWith({ expectation: { items: [item("F1"), item("F2")] } });
    expect(outcome(missing)["A1 covers every requirement item exactly once"]).toBe(false);
    const repeated = reviewWith({
      expectation: { items: [item("F1"), item("F1"), item("F2"), item("N1")] },
    });
    expect(outcome(repeated)["A1 covers every requirement item exactly once"]).toBe(false);
  });

  it("misses when an expectation names no crash or no resolver (mp-2283 only)", () => {
    const vague = reviewWith({ expectation: { items: [item("F1"), item("F2"), item("N1")] } });
    const results = outcome(vague);
    expect(results["mp-2283: A1 mentions a crash, throw or IndexOutOfRange"]).toBe(false);
    expect(results["mp-2283: A1 mentions a resolver"]).toBe(false);
    expect(Object.keys(outcome({ ...vague, changeId: "mp-2129" } as Review))).toHaveLength(2);
  });

  it("misses and names the hunk when a code hunk has no claim, but never asks for a docs hunk", () => {
    const results = checkReview(reviewWith({ claims: [] }));
    const claimed = results.find((result) => result.name.startsWith("A2"));
    expect(claimed).toMatchObject({ passed: false, detail: "not claimed: h1 (src/A.cs)" });
  });
});
