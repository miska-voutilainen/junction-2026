import { describe, expect, it } from "vitest";
import type { Requirement, Review } from "../contracts";
import type { PromptContext } from "../pipeline/promptContext";
import * as a1 from "./a1";
import * as a2 from "./a2";

const requirement: Requirement = {
  id: "MP-1",
  title: "Title",
  intent: "Intent text.",
  functional: [
    { id: "F1", text: "First." },
    { id: "F2", text: "Second." },
  ],
  nonFunctional: [{ id: "N1", text: "Third." }],
  derivedFrom: { kind: "github-issue", url: "https://example.test/1", note: "note" },
};

/** The messages the client would send back to the model. */
const problems = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.error?.issues.map((issue) => issue.message).join("; ") ?? "";

const expectationItem = (requirementItemId: string) => ({
  requirementItemId,
  expectedBehaviours: ["It works."],
  likelyAreas: [],
  expectedTests: [],
});

describe("a1", () => {
  const schema = a1.outputSchema(requirement);

  it("renders the requirement and the orientation, with no place for a diff or description", () => {
    const text = a1.render({ requirement });
    expect(text).toContain(a1.repositoryOrientation);
    expect(text).toContain("F1: First.");
    expect(text).toContain("N1: Third.");
    expect(a1.version).toBe("a1.v1");
  });

  it("accepts one item per requirement item, in any order", () => {
    const answer = { items: [expectationItem("N1"), expectationItem("F1"), expectationItem("F2")] };
    expect(schema.safeParse(answer).success).toBe(true);
  });

  it("rejects a missing item and names it", () => {
    const result = schema.safeParse({ items: [expectationItem("F1"), expectationItem("F2")] });
    expect(problems(result)).toContain("missing requirement items: N1");
  });

  it("rejects a repeated item", () => {
    const result = schema.safeParse({ items: ["F1", "F1", "F2", "N1"].map(expectationItem) });
    expect(problems(result)).toContain("F1 appears more than once");
  });

  it("rejects an unknown item id", () => {
    const result = schema.safeParse({ items: ["F1", "F2", "N1", "F9"].map(expectationItem) });
    expect(problems(result)).toContain('unknown requirement item id "F9"');
  });

  it("rejects 0 or more than 5 expected behaviours and more than 3 expected tests", () => {
    const none = { ...expectationItem("F1"), expectedBehaviours: [] };
    const tooMany = { ...expectationItem("F2"), expectedTests: ["a", "b", "c", "d"] };
    expect(schema.safeParse({ items: [none, tooMany, expectationItem("N1")] }).success).toBe(false);
    expect(
      schema.safeParse({
        items: [
          { ...none, expectedBehaviours: ["1", "2", "3", "4", "5", "6"] },
          expectationItem("F2"),
          expectationItem("N1"),
        ],
      }).success,
    ).toBe(false);
  });

  it("allows an empty likelyAreas and rejects an area that does not exist", () => {
    const bad = { ...expectationItem("F1"), likelyAreas: ["frontend"] };
    expect(
      schema.safeParse({ items: [bad, expectationItem("F2"), expectationItem("N1")] }).success,
    ).toBe(false);
  });
});

describe("a2", () => {
  const hunk = (id: string, file: string): Review["hunks"][number] => ({
    id,
    file,
    header: "@@ -1,1 +1,1 @@",
    oldStart: 1,
    oldLines: 1,
    newStart: 1,
    newLines: 1,
    lines: [],
  });
  const hunks = [hunk("h1", "src/A.cs"), hunk("h2", "tests/R/Resources/x.cs")];
  const schema = a2.outputSchema({ requirement, hunks });
  const story = {
    what: "It does a thing.",
    why: "Because.",
    touches: [{ symbol: "A.Run", file: "src/A.cs", note: "changed" }],
  };
  const claim = (overrides: Record<string, unknown> = {}) => ({
    requirementItemId: "F1",
    text: "A claim.",
    kind: "behaviour",
    hunkIds: ["h1"],
    pathGlob: null,
    citations: [{ file: "src/A.cs", side: "new", startLine: 1, endLine: 1, quote: "x" }],
    ...overrides,
  });
  const context: PromptContext = { hunksBlock: "<hunk>", filesBlock: "<file>", wasCut: false };

  it("accepts a claim that points at known hunks and items, or at no item", () => {
    expect(
      schema.safeParse({ story, claims: [claim(), claim({ requirementItemId: null })] }).success,
    ).toBe(true);
  });

  it("rejects an unknown hunk id", () => {
    const result = schema.safeParse({ story, claims: [claim({ hunkIds: ["h1", "h99"] })] });
    expect(problems(result)).toContain('unknown hunk id "h99"');
  });

  it("rejects an unknown requirement item id", () => {
    expect(schema.safeParse({ story, claims: [claim({ requirementItemId: "F7" })] }).success).toBe(
      false,
    );
  });

  it("rejects a pathGlob that matches no hunk and accepts one that does", () => {
    expect(
      schema.safeParse({ story, claims: [claim({ pathGlob: "docs/**", hunkIds: [] })] }).success,
    ).toBe(false);
    expect(
      schema.safeParse({
        story,
        claims: [claim({ pathGlob: "tests/**/Resources/**", hunkIds: [] })],
      }).success,
    ).toBe(true);
  });

  it("rejects an empty quote", () => {
    const empty = claim({
      citations: [{ file: "src/A.cs", side: "new", startLine: 1, endLine: 1, quote: "" }],
    });
    expect(schema.safeParse({ story, claims: [empty] }).success).toBe(false);
  });

  it("puts the author description before the code in anchored mode and omits it in blind mode", () => {
    const anchored = a2.render({
      requirement,
      context,
      expectation: null,
      authorDescription: "The PR says X.",
    });
    expect(anchored.indexOf("<author-description>")).toBeLessThan(anchored.indexOf("<hunks>"));
    expect(anchored).not.toContain("<expectation>");

    const blind = a2.render({ requirement, context, expectation: "{}", authorDescription: null });
    expect(blind).not.toContain("<author-description>");
    expect(blind).toContain("<expectation>");
    expect(a2.version).toBe("a2.v1");
  });
});
