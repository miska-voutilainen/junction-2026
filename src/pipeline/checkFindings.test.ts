import { describe, expect, it } from "vitest";
import type { Review } from "../contracts";
import type { FindingDraft } from "../prompts/a3";
import type { Statement } from "../prompts/a4";
import {
  checkAreaFindings,
  checkContradictions,
  checkRefusals,
  fixedRefusalsFor,
  legacyRefusalsFor,
  mergeFixedRefusals,
} from "./checkFindings";
import type { SideReader } from "./quoteCheck";

type QuoteCheck = Review["quoteCheck"];

const files: Record<string, string> = {
  "src/MessagePack/Reader.cs": "line one\nint x = 1;\nline three",
  "tests/A/Test.cs": "[Fact]\nvoid T() {}",
};
const readSide: SideReader = async (_side, file) => files[file] ?? null;
const freshCheck = (): QuoteCheck => ({
  checked: 0,
  passed: 0,
  downgraded: 0,
  dropped: 0,
  failures: [],
});

const cite = (file: string, quote: string, startLine = 2, endLine = 2) => ({
  file,
  side: "new" as const,
  startLine,
  endLine,
  quote,
});
const draft = (citations: FindingDraft["citations"]): FindingDraft => ({
  kind: "defect",
  severity: "high",
  title: "t",
  detail: "d",
  hunkIds: ["h1"],
  citations,
});

describe("checkAreaFindings", () => {
  it("sets the area from the first passing citation's path, not from the model", async () => {
    const check = freshCheck();
    const [finding] = await checkAreaFindings(
      [draft([cite("src/MessagePack/Reader.cs", "int x = 1;")])],
      readSide,
      check,
    );
    expect(finding.area).toBe("security");
    expect(finding.statement).toBeNull();
  });

  it("skips a failing first citation when choosing the area", async () => {
    const check = freshCheck();
    const [finding] = await checkAreaFindings(
      [
        draft([
          cite("src/MessagePack.Annotations/A.cs", "nope"),
          cite("src/MessagePack/Reader.cs", "int x = 1;"),
        ]),
      ],
      readSide,
      check,
    );
    expect(finding.area).toBe("security");
    expect(finding.citations).toHaveLength(1);
    expect(check.failures).toHaveLength(1);
  });

  it("gives a finding that cites only a test file no area", async () => {
    const [finding] = await checkAreaFindings(
      [draft([cite("tests/A/Test.cs", "void T() {}", 2, 2)])],
      readSide,
      freshCheck(),
    );
    expect(finding.area).toBeNull();
  });

  it("drops a finding with no passing citation and counts it", async () => {
    const check = freshCheck();
    const findings = await checkAreaFindings(
      [draft([cite("src/MessagePack/Reader.cs", "made up")]), draft([])],
      readSide,
      check,
    );
    expect(findings).toEqual([]);
    expect(check.dropped).toBe(2);
    expect(check.failures[0]).toMatchObject({ itemId: "a3-f1" });
  });
});

describe("checkContradictions", () => {
  const hunk = {
    id: "h1",
    file: "src/MessagePack/Reader.cs",
    newStart: 1,
    newLines: 3,
  } as Review["hunks"][number];
  const statement = (overrides: Partial<Statement>): Statement => ({
    statement: "It is fine.",
    verdict: "contradicted",
    claimIds: [],
    explanation: "It is not.",
    citations: [cite("src/MessagePack/Reader.cs", "int x = 1;")],
    ...overrides,
  });

  it("makes a high-severity contradiction with no area, routed to the cited hunk", async () => {
    const [finding] = await checkContradictions(
      [statement({})],
      [],
      [hunk],
      readSide,
      freshCheck(),
    );
    expect(finding).toMatchObject({
      kind: "contradiction",
      area: null,
      severity: "high",
      statement: "It is fine.",
      hunkIds: ["h1"],
    });
  });

  it("routes a contradiction cited on the old side to the hunk that removed those lines", async () => {
    const removing = { ...hunk, id: "h2", oldStart: 1, oldLines: 3, newStart: 50, newLines: 0 };
    const [finding] = await checkContradictions(
      [
        statement({
          citations: [{ ...cite("src/MessagePack/Reader.cs", "line one", 1, 1), side: "old" }],
        }),
      ],
      [],
      [hunk, removing],
      readSide,
      freshCheck(),
    );
    expect(finding.hunkIds).toEqual(["h2"]);
  });

  it("keeps an unsupported statement at medium severity even with no citation", async () => {
    const [finding] = await checkContradictions(
      [statement({ verdict: "unsupported", citations: [] })],
      [],
      [hunk],
      readSide,
      freshCheck(),
    );
    expect(finding.severity).toBe("medium");
  });

  it("keeps a contradicted statement whose quote does not match, without citations and not counted as dropped", async () => {
    const check = freshCheck();
    const findings = await checkContradictions(
      [
        statement({ citations: [cite("src/MessagePack/Reader.cs", "made up")] }),
        statement({ verdict: "supported" }),
      ],
      [],
      [hunk],
      readSide,
      check,
    );
    expect(findings).toMatchObject([{ kind: "contradiction", severity: "high", citations: [] }]);
    expect(check.dropped).toBe(0);
    expect(check.failures).toMatchObject([
      { itemId: "a4-s1", reason: expect.stringContaining("quote not found") },
    ]);
  });
});

describe("refusals", () => {
  it("drops an unknown rule id and records it", () => {
    const check = freshCheck();
    const refusals = checkRefusals(
      [
        { ruleId: "R7", reason: "a", hunkIds: ["h1"] },
        { ruleId: "R9", reason: "b", hunkIds: [] },
      ],
      check,
    );
    expect(refusals.map((refusal) => refusal.ruleId)).toEqual(["R7"]);
    expect(refusals[0].source).toBe("ai");
    expect(check.failures).toEqual([
      { itemId: "a3-r2", citation: null, reason: 'unknown rule id "R9"' },
    ]);
  });

  it("adds a rule refusal for each fixed trigger a hunk matches", () => {
    const hunks = [
      { id: "h1", file: "src/MessagePack.Annotations/KeyAttribute.cs" },
      { id: "h2", file: "src/MessagePack/Reader.cs" },
      { id: "h3", file: "src/MessagePack.SourceGenerator/PublicAPI.Unshipped.txt" },
    ] as Review["hunks"];
    expect(
      fixedRefusalsFor(hunks).map((refusal) => [refusal.ruleId, refusal.source, refusal.hunkIds]),
    ).toEqual([
      ["R7", "rule", ["h3"]],
      ["R7", "rule", ["h1"]],
    ]);
  });

  it("adds none when no hunk matches", () => {
    expect(
      fixedRefusalsFor([{ id: "h1", file: "src/MessagePack/Reader.cs" }] as Review["hunks"]),
    ).toEqual([]);
  });
});

describe("legacyRefusalsFor", () => {
  it("adds one R8 rule refusal per zone, naming the owner and the contract", () => {
    const hunks = [
      { id: "h1", file: "src/MessagePack/MessagePackWriter.cs" },
      { id: "h2", file: "src/MessagePack/Resolvers/DynamicObjectResolver.cs" },
      { id: "h3", file: "src/MessagePack/MessagePackCode.cs" },
    ] as Review["hunks"];
    const refusals = legacyRefusalsFor(hunks);
    expect(refusals.map((refusal) => [refusal.ruleId, refusal.source, refusal.hunkIds])).toEqual([
      ["R8", "rule", ["h2"]],
      ["R8", "rule", ["h1", "h3"]],
    ]);
    expect(refusals[1].reason).toBe(
      "Edits legacy code in Wire format (the bytes every deployed reader and writer agrees on): the runtime owner (the maintainers) decides",
    );
  });

  it("ignores files outside every zone", () => {
    const hunks = [
      { id: "h1", file: "src/MessagePack/Resolvers/StandardResolver.cs" },
    ] as Review["hunks"];
    expect(legacyRefusalsFor(hunks)).toEqual([]);
  });
});

describe("mergeFixedRefusals", () => {
  const ai = (ruleId: string, hunkIds: string[]) => ({
    ruleId,
    source: "ai" as const,
    reason: "a",
    hunkIds,
  });
  const fixed = (ruleId: string, hunkIds: string[]) => ({
    ruleId,
    source: "rule" as const,
    reason: "f",
    hunkIds,
  });

  it("adds a rule refusal only for matched hunks no AI refusal of that rule lists", () => {
    const merged = mergeFixedRefusals([ai("R7", ["h2"])], [fixed("R7", ["h2", "h3"])]);
    expect(merged).toEqual([ai("R7", ["h2"]), fixed("R7", ["h3"])]);
  });

  it("adds nothing when the AI already refused every matched hunk", () => {
    expect(mergeFixedRefusals([ai("R7", ["h2"])], [fixed("R7", ["h2"])])).toEqual([
      ai("R7", ["h2"]),
    ]);
  });

  it("ignores an AI refusal under another rule id", () => {
    expect(mergeFixedRefusals([ai("R1", ["h2"])], [fixed("R7", ["h2"])])).toEqual([
      ai("R1", ["h2"]),
      fixed("R7", ["h2"]),
    ]);
  });
});
