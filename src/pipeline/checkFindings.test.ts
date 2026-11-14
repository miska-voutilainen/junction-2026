import { describe, expect, it } from "vitest";
import type { Review } from "../contracts";
import type { FindingDraft } from "../prompts/a3";
import type { Statement } from "../prompts/a4";
import {
  checkAreaFindings,
  checkContradictions,
  checkRefusals,
  fixedRefusalsFor,
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

  it("drops a contradicted statement whose quote does not match and ignores supported ones", async () => {
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
    expect(findings).toEqual([]);
    expect(check.dropped).toBe(1);
  });
});

describe("refusals", () => {
  it("drops an unknown rule id and records it", () => {
    const check = freshCheck();
    const refusals = checkRefusals(
      [
        { ruleId: "R7", reason: "a", hunkIds: ["h1"] },
        { ruleId: "R8", reason: "b", hunkIds: [] },
      ],
      check,
    );
    expect(refusals.map((refusal) => refusal.ruleId)).toEqual(["R7"]);
    expect(refusals[0].source).toBe("ai");
    expect(check.failures).toMatchObject([{ itemId: "a3-r2", reason: "unknown rule id" }]);
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
