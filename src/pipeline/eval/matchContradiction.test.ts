import { describe, expect, it } from "vitest";
import type { AnswerKey, Review } from "@/contracts";
import {
  findContradictionMatch,
  STATEMENT_TOKEN_OVERLAP_MIN,
  statementMatches,
} from "./matchContradiction";

type Finding = Review["findings"][number];

const SENTENCE = "The cache is cleared on every write.";

function key(overrides: Partial<AnswerKey> = {}): AnswerKey {
  return {
    plantId: "p2",
    changeId: "c1",
    kind: "contradiction",
    area: null,
    file: null,
    startLine: null,
    endLine: null,
    defect: SENTENCE,
    why: "synthetic",
    writtenBy: "tester",
    writtenAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function finding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: "f1",
    kind: "contradiction",
    area: null,
    severity: "high",
    title: "t",
    detail: "d",
    statement: SENTENCE,
    hunkIds: [],
    citations: [],
    ...overrides,
  };
}

describe("statementMatches", () => {
  it("matches ignoring case and whitespace", () => {
    expect(statementMatches("  the CACHE is\n cleared   on every write. ", SENTENCE)).toBe(true);
  });

  it("matches at exactly the minimum overlap", () => {
    expect(STATEMENT_TOKEN_OVERLAP_MIN).toBe(0.8);
    // Key has 5 words; 4 of 5 is exactly 0.8.
    expect(statementMatches("one two three four", "one two three four five")).toBe(true);
  });

  it("does not match below the minimum overlap", () => {
    expect(statementMatches("one two three", "one two three four five")).toBe(false);
  });

  it("is not hurt by extra words in the statement", () => {
    expect(statementMatches(`The description claims: ${SENTENCE} See above.`, SENTENCE)).toBe(true);
  });
});

describe("findContradictionMatch", () => {
  it("returns the first matching contradiction", () => {
    const other = finding({ id: "f1", statement: "Unrelated claim about logging." });
    const first = finding({ id: "f2" });
    const second = finding({ id: "f3" });
    expect(findContradictionMatch([other, first, second], key())?.id).toBe("f2");
  });

  it("ignores findings with a null statement or another kind", () => {
    const findings = [finding({ statement: null }), finding({ kind: "defect" })];
    expect(findContradictionMatch(findings, key())).toBeNull();
  });

  it("returns null for a key that is not a contradiction", () => {
    expect(findContradictionMatch([finding()], key({ kind: "planted-bug" }))).toBeNull();
  });
});
