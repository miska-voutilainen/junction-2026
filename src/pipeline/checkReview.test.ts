import { describe, expect, it } from "vitest";
import type { AnswerKey, Review } from "../contracts";
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
    reviewer: { promptVersions: { a5: "none" } },
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
    claims: [{ id: "c1", hunkIds: ["h1"], level: "supported", evidence: [] }],
    refusals: [],
    findings: [],
    ...overrides,
  } as unknown as Review;
}

const verifiedClaim = {
  id: "c1",
  hunkIds: ["h1"],
  level: "verified",
  evidence: [
    {
      kind: "differential-test",
      base: { result: "fail", output: "" },
      head: { result: "pass", output: "" },
    },
  ],
};

const outcome = (review: Review) =>
  Object.fromEntries(checkReview(review).map((result) => [result.name, result.passed]));

describe("checkReview", () => {
  it("passes a review that covers items, mentions the crash and resolver, and claims every code hunk", () => {
    const refused = reviewWith({
      refusals: [{ ruleId: "R7", source: "ai" }] as Review["refusals"],
      claims: [verifiedClaim] as unknown as Review["claims"],
    });
    expect(Object.values(outcome(refused)).every(Boolean)).toBe(true);
    expect(checkReview(refused)).toHaveLength(6);
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

  it("misses the A5 case when no claim is Verified by a fail-then-pass test", () => {
    const name =
      "mp-2283: A5 verifies a claim with a test that fails on the base and passes on the head";
    expect(outcome(reviewWith({}))[name]).toBe(false);
  });

  it("misses and names the hunk when a code hunk has no claim, but never asks for a docs hunk", () => {
    const results = checkReview(reviewWith({ claims: [] }));
    const claimed = results.find((result) => result.name.startsWith("A2"));
    expect(claimed).toMatchObject({ passed: false, detail: "not claimed: h1 (src/A.cs)" });
  });
});

describe("checkReview: A3 and A4 cases for mp-2283", () => {
  const key = {
    kind: "contradiction",
    defect: "The change touches only the generator.",
  } as AnswerKey;
  const refusal = (ruleId: string, source: "ai" | "rule") => ({ id: "r1", ruleId, source });
  const finding = (statement: string) => ({ id: "f1", kind: "contradiction", statement });
  const names = (review: Review) => checkReview(review, key);

  it("passes when a model refusal cites R7 or R1 and A4 marks the planted sentence", () => {
    const review = reviewWith({
      refusals: [refusal("R1", "ai")] as Review["refusals"],
      findings: [finding("the change touches only the generator")] as Review["findings"],
      claims: [verifiedClaim] as unknown as Review["claims"],
    });
    expect(names(review).filter((result) => !result.passed)).toEqual([]);
    expect(names(review)).toHaveLength(7);
  });

  it("misses when the only R7 is a fixed rule refusal, or no finding matches the sentence", () => {
    const review = reviewWith({
      refusals: [refusal("R7", "rule")] as Review["refusals"],
      findings: [finding("Something else entirely.")] as Review["findings"],
    });
    const missed = names(review)
      .filter((result) => !result.passed)
      .map((result) => result.name);
    expect(missed).toEqual([
      "mp-2283: A3 refuses with R7 or R1",
      "mp-2283: A5 verifies a claim with a test that fails on the base and passes on the head",
      "mp-2283: A4 catches the planted false statement",
    ]);
  });

  it("adds no A4 case without the answer key", () => {
    expect(checkReview(reviewWith({}))).toHaveLength(6);
  });
});
