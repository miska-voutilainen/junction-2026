import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import type { ModelClient } from "../ai/client";
import { ReviewSchema, type ChangeInput, type Requirement } from "../contracts";
import { levelsFromReportCard } from "../rules/ladder";
import { checkReview } from "./checkReview";
import { runReview, type ModelStep } from "./runReview";
import { createUsageTally } from "./usageTally";

const requirement: Requirement = {
  id: "MP-1",
  title: "Count items",
  intent: "The resolver counts items.",
  functional: [{ id: "F1", text: "It counts." }],
  nonFunctional: [{ id: "N1", text: "No change elsewhere. (inferred)" }],
  derivedFrom: { kind: "github-issue", url: "https://example.test/1", note: "note" },
};

let repoDir: string;
let change: ChangeInput;

function git(...args: string[]): string {
  return execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.test", ...args], {
    cwd: repoDir,
    encoding: "utf8",
  }).trim();
}

/** A two-commit repository: the head changes one source line and adds a docs line. */
beforeAll(() => {
  repoDir = mkdtempSync(join(tmpdir(), "countersign-run-"));
  git("init", "-q");
  mkdirSync(join(repoDir, "src"));
  writeFileSync(join(repoDir, "src", "Resolver.cs"), "class Resolver\n{\n    int Count = 1;\n}\n");
  writeFileSync(join(repoDir, "README.md"), "# Readme\n");
  git("add", ".");
  git("commit", "-qm", "base");
  const baseSha = git("rev-parse", "HEAD");
  writeFileSync(join(repoDir, "src", "Resolver.cs"), "class Resolver\n{\n    int Count = 0;\n}\n");
  writeFileSync(join(repoDir, "README.md"), "# Readme\nCounts items.\n");
  git("add", ".");
  git("commit", "-qm", "head");
  change = {
    id: "t-1",
    kind: "tieto",
    title: "Count items",
    requirementId: "MP-1",
    parentChangeId: null,
    repo: "example/repo",
    branch: "b",
    baseSha,
    headSha: git("rev-parse", "HEAD"),
    authorAgent: "Coding agent (test)",
    authorDescription: { text: "AUTHOR-DESCRIPTION-TEXT", synthetic: true, writtenBy: "test" },
  };
});

const expectation = {
  items: [
    {
      requirementItemId: "F1",
      expectedBehaviours: ["Counting works."],
      likelyAreas: ["generator"],
      expectedTests: [],
    },
    {
      requirementItemId: "N1",
      expectedBehaviours: ["Nothing else changes."],
      likelyAreas: [],
      expectedTests: [],
    },
  ],
};

const story = {
  what: "Starts the count at zero.",
  why: "The count was off by one.",
  touches: [{ symbol: "Resolver.Count", file: "src/Resolver.cs", note: "initial value" }],
};

const citeCount = (quote: string) => [
  { file: "src/Resolver.cs", side: "new", startLine: 3, endLine: 3, quote },
];

const areaReview = {
  findings: [
    {
      kind: "defect",
      severity: "high",
      title: "Count starts at the wrong value",
      detail: "The count starts at zero.",
      hunkIds: ["h2"],
      citations: citeCount("int Count = 0;"),
    },
    {
      kind: "missing",
      severity: "low",
      title: "No test",
      detail: "Nothing tests it.",
      hunkIds: ["h2"],
      citations: citeCount("logger.Info()"),
    },
  ],
  refusals: [
    { ruleId: "R7", reason: "Changes documented behaviour.", hunkIds: ["h2"] },
    { ruleId: "R99", reason: "Not a rule.", hunkIds: ["h2"] },
  ],
};

const descriptionCheck = {
  statements: [
    {
      statement: "AUTHOR-DESCRIPTION-TEXT",
      verdict: "contradicted",
      claimIds: ["c1"],
      explanation: "The code starts the count at zero.",
      citations: citeCount("int Count = 0;"),
    },
  ],
};

/** A fake model that validates its canned answers with the call's own schema, as the real client does. */
function fakeClient(a2Claims: unknown[]): {
  client: ModelClient;
  prompts: Record<string, string>;
  runIndexes: (number | undefined)[];
} {
  const prompts: Record<string, string> = {};
  const runIndexes: (number | undefined)[] = [];
  const answers: Record<string, unknown> = {
    "a1.v1": expectation,
    "a2.v1": { story, claims: a2Claims },
    "a3.v2": areaReview,
    "a4.v1": descriptionCheck,
  };
  const client: ModelClient = {
    async call(request) {
      prompts[request.promptVersion] = request.prompt;
      runIndexes.push(request.runIndex);
      return request.schema.parse(answers[request.promptVersion]);
    },
  };
  return { client, prompts, runIndexes };
}

const goodClaim = {
  requirementItemId: "F1",
  text: "The count starts at zero.",
  kind: "behaviour",
  hunkIds: ["h2"],
  pathGlob: null,
  citations: [
    { file: "src/Resolver.cs", side: "new", startLine: 3, endLine: 3, quote: "int Count = 0;" },
  ],
};
const invented = {
  ...goodClaim,
  text: "It also logs.",
  citations: [
    { file: "src/Resolver.cs", side: "new", startLine: 3, endLine: 3, quote: "logger.Info()" },
  ],
};

describe("runReview with a fake model", () => {
  async function review(
    claims: unknown[],
    options: { mode?: "anchored"; runIndex?: number; steps?: ModelStep[] } = {},
  ) {
    const { client, prompts, runIndexes } = fakeClient(claims);
    const tally = createUsageTally();
    const result = await runReview({
      change,
      requirement,
      repoDir,
      client,
      usage: tally,
      levels: levelsFromReportCard(null),
      ...options,
    });
    return { result, prompts, runIndexes };
  }

  it("assembles a schema-valid blind-first review with every step's version", async () => {
    const { result } = await review([goodClaim, invented]);
    expect(ReviewSchema.safeParse(result).success).toBe(true);
    expect(result.mode).toBe("blind-first");
    expect(result.expectation).toEqual(expectation);
    expect(result.reviewer.promptVersions).toEqual({
      a1: "a1.v1",
      a2: "a2.v1",
      a3: "a3.v2",
      a4: "a4.v1",
      a5: "none",
    });
    expect(result.retractions).toEqual([]);
    // git lists README.md before src/, so the docs hunk is h1.
    expect(result.hunks.map((hunk) => [hunk.id, hunk.file])).toEqual([
      ["h1", "README.md"],
      ["h2", "src/Resolver.cs"],
    ]);
    expect(result.run.id).toMatch(/^\d{8}T\d{6}Z$/);
  });

  it("keeps a finding whose quote matches, with the area of the file it cites, and drops the invented one", async () => {
    const { result } = await review([goodClaim]);
    // src/Resolver.cs is in no area rule's folder, so the path gives it no area.
    expect(result.findings.map((finding) => [finding.id, finding.kind, finding.area])).toEqual([
      ["f1", "defect", null],
      ["f2", "contradiction", null],
    ]);
    expect(result.quoteCheck.dropped).toBe(1);
    expect(result.quoteCheck.failures.map((failure) => failure.itemId)).toEqual(["a3-f2", "a3-r2"]);
  });

  it("turns a contradicted statement into a high-severity contradiction finding with the sentence", async () => {
    const { result } = await review([goodClaim]);
    expect(result.findings[1]).toMatchObject({
      kind: "contradiction",
      severity: "high",
      statement: "AUTHOR-DESCRIPTION-TEXT",
      hunkIds: ["h2"],
    });
  });

  it("keeps a refusal with a known rule id and records the unknown one", async () => {
    const { result } = await review([goodClaim]);
    expect(result.refusals).toEqual([
      {
        id: "r1",
        ruleId: "R7",
        source: "ai",
        reason: "Changes documented behaviour.",
        hunkIds: ["h2"],
      },
    ]);
    expect(result.quoteCheck.failures.at(-1)).toMatchObject({
      itemId: "a3-r2",
      citation: null,
      reason: 'unknown rule id "R99"',
    });
  });

  it("builds the receipt draft from the review", async () => {
    const { result } = await review([goodClaim, invented]);
    expect(result.receiptDraft.checked).toHaveLength(1);
    // A Supported claim's quote exists; nothing ran the behaviour, so it is not "tool".
    expect(result.receiptDraft.checked[0].by).toBe("ai-supported");
    expect(result.receiptDraft.notChecked.map((item) => item.reason).slice(0, 2)).toEqual([
      "No Verified or Supported claim covers it",
      "Finding f1 (defect) names this hunk",
    ]);
    expect(result.receiptDraft.notChecked.map((item) => item.item)).toEqual([
      "README.md:1 (h1)",
      "src/Resolver.cs:1 (h2)",
      "It also logs.",
    ]);
    expect(result.receiptDraft.residualRisk.text).toContain("R7");
    expect(result.receiptDraft.residualRisk.acceptedRefusalIds).toEqual([]);
  });

  it("anchored mode: A2 sees the description first, A1 and A3 are skipped, A4 still runs", async () => {
    const { result, prompts } = await review([goodClaim], { mode: "anchored" });
    expect(result.mode).toBe("anchored");
    expect(result.expectation).toBeNull();
    expect(result.reviewer.promptVersions).toMatchObject({ a1: "none", a3: "none", a4: "a4.v1" });
    expect(prompts["a1.v1"]).toBeUndefined();
    expect(prompts["a3.v2"]).toBeUndefined();
    expect(prompts["a2.v1"].indexOf("AUTHOR-DESCRIPTION-TEXT")).toBeLessThan(
      prompts["a2.v1"].indexOf("<requirement"),
    );
    expect(result.refusals).toEqual([]);
    expect(result.findings.map((finding) => finding.kind)).toEqual(["contradiction"]);
  });

  it("blind comparison steps are A1, A2 and A4: A3 never runs", async () => {
    const { result, prompts } = await review([goodClaim], { steps: ["a1", "a2", "a4"] });
    expect(prompts["a3.v2"]).toBeUndefined();
    expect(result.reviewer.promptVersions).toMatchObject({ a1: "a1.v1", a3: "none", a4: "a4.v1" });
    expect(result.refusals).toEqual([]);
  });

  it("adds the fixed rule refusal on a run without A3", async () => {
    const apiRepo = mkdtempSync(join(tmpdir(), "countersign-api-"));
    const apiGit = (...args: string[]) =>
      execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.test", ...args], {
        cwd: apiRepo,
        encoding: "utf8",
      }).trim();
    apiGit("init", "-q");
    writeFileSync(join(apiRepo, "PublicAPI.Unshipped.txt"), "A\n");
    apiGit("add", ".");
    apiGit("commit", "-qm", "base");
    const baseSha = apiGit("rev-parse", "HEAD");
    writeFileSync(join(apiRepo, "PublicAPI.Unshipped.txt"), "A\nB\n");
    apiGit("add", ".");
    apiGit("commit", "-qm", "head");
    const { client, prompts } = fakeClient([
      {
        ...goodClaim,
        hunkIds: ["h1"],
        citations: [
          { file: "PublicAPI.Unshipped.txt", side: "new", startLine: 2, endLine: 2, quote: "B" },
        ],
      },
    ]);
    const result = await runReview({
      change: { ...change, baseSha, headSha: apiGit("rev-parse", "HEAD") },
      requirement,
      repoDir: apiRepo,
      client,
      usage: createUsageTally(),
      levels: levelsFromReportCard(null),
      steps: ["a1", "a2", "a4"],
    });
    expect(prompts["a3.v2"]).toBeUndefined();
    expect(result.refusals).toHaveLength(1);
    expect(result.refusals[0]).toMatchObject({ source: "rule", ruleId: "R7" });
    expect(result.refusals[0]?.hunkIds).toHaveLength(1);
  });

  it("an explicit steps list can turn A4 off", async () => {
    const { result, prompts } = await review([goodClaim], { steps: ["a1", "a2", "a3"] });
    expect(prompts["a4.v1"]).toBeUndefined();
    expect(result.reviewer.promptVersions.a4).toBe("none");
    expect(result.findings.some((finding) => finding.kind === "contradiction")).toBe(false);
  });

  it("refuses a steps list A3 cannot run on", async () => {
    await expect(review([goodClaim], { steps: ["a2", "a3"] })).rejects.toThrow(/A3 needs A1/);
  });

  it("refuses a steps list A5 cannot run on", async () => {
    await expect(review([goodClaim], { steps: ["a2", "a5"] })).rejects.toThrow(/A5 needs A1/);
  });

  it("leaves A5 at none when the change touches no test project", async () => {
    const { result, prompts } = await review([goodClaim], { steps: ["a1", "a2", "a5"] });
    expect(prompts["a5.v2"]).toBeUndefined();
    expect(result.reviewer.promptVersions.a5).toBe("none");
    expect(result.retractions).toEqual([]);
  });

  it("passes the run index to every call", async () => {
    const { runIndexes } = await review([goodClaim], { runIndex: 2 });
    expect(runIndexes).toEqual([2, 2, 2, 2]);
  });

  it("gives ids in output order, keeps the invented claim as unverified and records its failure", async () => {
    const { result } = await review([goodClaim, invented]);
    expect(result.claims.map((claim) => [claim.id, claim.level])).toEqual([
      ["c1", "supported"],
      ["c2", "unverified"],
    ]);
    // Two claim citations, then A3's two and A4's one; the claim check is the first two.
    expect(result.quoteCheck).toMatchObject({ checked: 5, passed: 3, downgraded: 1, dropped: 1 });
    expect(result.quoteCheck.failures[0]).toEqual({
      itemId: "c2",
      citation: invented.citations[0],
      reason: "quote not found in lines 3–3 of the new file",
    });
  });

  it("routes the recorded review: a hunk a finding names is read even when a claim supports it", async () => {
    const { result } = await review([goodClaim]);
    expect(result.routing.coverage).toEqual({ h1: "read", h2: "read" });
    expect(result.routing.tier).toBe("full");
  });

  it("sends the author description to A4 only, after the code was described without it", async () => {
    const { prompts } = await review([goodClaim]);
    for (const version of ["a1.v1", "a2.v1", "a3.v2"])
      expect(prompts[version]).not.toContain("AUTHOR-DESCRIPTION-TEXT");
    expect(prompts["a4.v1"]).toContain("AUTHOR-DESCRIPTION-TEXT");
  });

  it("sends A2 the expectation, the head file with line numbers and the hunks", async () => {
    const { prompts } = await review([goodClaim]);
    expect(prompts["a1.v1"]).not.toContain("<hunks>");
    expect(prompts["a2.v1"]).toContain("<expectation>");
    expect(prompts["a2.v1"]).toContain("    3|     int Count = 0;");
    expect(prompts["a2.v1"]).toContain('<hunk id="h2" file="src/Resolver.cs"');
  });

  it("fails the call, writing nothing, when the answer names a hunk that is not in the diff", async () => {
    await expect(review([{ ...goodClaim, hunkIds: ["h9"] }])).rejects.toThrow(/unknown hunk id/);
  });

  it("feeds checkReview: every code hunk claimed, expectation complete", async () => {
    const { result } = await review([goodClaim]);
    // The README hunk h1 is docs, so one claim on the source hunk h2 covers every non-docs hunk.
    expect(checkReview(result).map((check) => [check.name, check.passed])).toEqual([
      ["A1 covers every requirement item exactly once", true],
      ["A2 lists every hunk of a non-docs, non-generated file in a claim", true],
    ]);
  });
});
