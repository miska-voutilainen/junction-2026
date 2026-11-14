import { describe, expect, it } from "vitest";
import type { AnswerKey, Review } from "@/contracts";
import {
  countFindingsOnPlants,
  findPlantedBugMatch,
  isPlantedBugMatch,
  PLANT_LINE_TOLERANCE,
} from "./matchPlantedBug";

type Finding = Review["findings"][number];
type Citation = Finding["citations"][number];

// Synthetic plant: security bug at lines 20-25 of src/Foo.cs.
function key(overrides: Partial<AnswerKey> = {}): AnswerKey {
  return {
    plantId: "p1",
    changeId: "c1",
    kind: "planted-bug",
    area: "security",
    file: "src/Foo.cs",
    startLine: 20,
    endLine: 25,
    defect: "The cache is cleared on every write.",
    why: "synthetic",
    writtenBy: "tester",
    writtenAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function cite(startLine: number, endLine: number, overrides: Partial<Citation> = {}): Citation {
  return { file: "src/Foo.cs", side: "new", startLine, endLine, quote: "x", ...overrides };
}

function finding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: "f1",
    kind: "defect",
    area: "security",
    severity: "high",
    title: "t",
    detail: "d",
    statement: null,
    hunkIds: [],
    citations: [cite(22, 22)],
    ...overrides,
  };
}

describe("isPlantedBugMatch", () => {
  it("matches a citation inside the range", () => {
    expect(isPlantedBugMatch(finding(), key())).toBe(true);
  });

  it("matches at exactly the tolerance on both sides", () => {
    expect(PLANT_LINE_TOLERANCE).toBe(3);
    expect(isPlantedBugMatch(finding({ citations: [cite(17, 17)] }), key())).toBe(true);
    expect(isPlantedBugMatch(finding({ citations: [cite(28, 28)] }), key())).toBe(true);
    expect(isPlantedBugMatch(finding({ citations: [cite(10, 17)] }), key())).toBe(true);
    expect(isPlantedBugMatch(finding({ citations: [cite(28, 40)] }), key())).toBe(true);
  });

  it("never matches a contradiction key, even one with an area and lines", () => {
    expect(isPlantedBugMatch(finding(), key({ kind: "contradiction" }))).toBe(false);
  });

  it("does not match one line past the tolerance", () => {
    expect(isPlantedBugMatch(finding({ citations: [cite(16, 16)] }), key())).toBe(false);
    expect(isPlantedBugMatch(finding({ citations: [cite(29, 29)] }), key())).toBe(false);
  });

  it("matches a citation that spans across the range", () => {
    expect(isPlantedBugMatch(finding({ citations: [cite(1, 100)] }), key())).toBe(true);
  });

  it("ignores old-side citations and other files", () => {
    const oldSide = finding({ citations: [cite(22, 22, { side: "old" })] });
    const otherFile = finding({ citations: [cite(22, 22, { file: "src/Bar.cs" })] });
    expect(isPlantedBugMatch(oldSide, key())).toBe(false);
    expect(isPlantedBugMatch(otherFile, key())).toBe(false);
  });

  it("matches when any one citation hits", () => {
    expect(isPlantedBugMatch(finding({ citations: [cite(1, 1), cite(21, 21)] }), key())).toBe(true);
  });

  it("requires the same area", () => {
    expect(isPlantedBugMatch(finding({ area: "performance" }), key())).toBe(false);
  });

  it("never matches a null area on the finding or the key", () => {
    expect(isPlantedBugMatch(finding({ area: null }), key({ area: null }))).toBe(false);
    expect(isPlantedBugMatch(finding({ area: null }), key())).toBe(false);
    expect(isPlantedBugMatch(finding(), key({ area: null }))).toBe(false);
  });

  it("never matches a key without file or lines", () => {
    expect(isPlantedBugMatch(finding(), key({ file: null }))).toBe(false);
    expect(isPlantedBugMatch(finding(), key({ startLine: null }))).toBe(false);
    expect(isPlantedBugMatch(finding(), key({ endLine: null }))).toBe(false);
  });

  it("counts defect and missing but not scope-creep or contradiction", () => {
    expect(isPlantedBugMatch(finding({ kind: "missing" }), key())).toBe(true);
    expect(isPlantedBugMatch(finding({ kind: "scope-creep" }), key())).toBe(false);
    expect(isPlantedBugMatch(finding({ kind: "contradiction" }), key())).toBe(false);
  });
});

describe("findPlantedBugMatch", () => {
  it("returns the first match in output order", () => {
    const miss = finding({ id: "f1", citations: [cite(90, 90)] });
    const first = finding({ id: "f2" });
    const second = finding({ id: "f3" });
    expect(findPlantedBugMatch([miss, first, second], key())?.id).toBe("f2");
  });

  it("returns null when nothing matches", () => {
    expect(findPlantedBugMatch([finding({ citations: [cite(90, 90)] })], key())).toBeNull();
    expect(findPlantedBugMatch([], key())).toBeNull();
  });
});

describe("countFindingsOnPlants", () => {
  it("counts defect and missing findings and those on the plant", () => {
    const findings = [
      finding({ id: "f1" }),
      finding({ id: "f2", kind: "missing", citations: [cite(90, 90)] }),
      finding({ id: "f3", kind: "scope-creep" }),
      finding({ id: "f4", kind: "contradiction" }),
    ];
    expect(countFindingsOnPlants(findings, key())).toEqual({ total: 2, matchedPlant: 1 });
  });

  it("returns zeros for an empty run", () => {
    expect(countFindingsOnPlants([], key())).toEqual({ total: 0, matchedPlant: 0 });
  });
});
