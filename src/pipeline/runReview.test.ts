import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import type { ModelClient } from "../ai/client";
import { ReviewSchema, type ChangeInput, type Requirement } from "../contracts";
import { levelsFromReportCard } from "../rules/ladder";
import { checkReview } from "./checkReview";
import { runReview } from "./runReview";
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

/** A fake model that validates its canned answers with the call's own schema, as the real client does. */
function fakeClient(a2Claims: unknown[]): { client: ModelClient; prompts: string[] } {
  const prompts: string[] = [];
  const answers: Record<string, unknown> = {
    "a1.v1": expectation,
    "a2.v1": { story, claims: a2Claims },
  };
  const client: ModelClient = {
    async call(request) {
      prompts.push(request.prompt);
      return request.schema.parse(answers[request.promptVersion]);
    },
  };
  return { client, prompts };
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
  async function review(claims: unknown[]) {
    const { client, prompts } = fakeClient(claims);
    const tally = createUsageTally();
    const result = await runReview({
      change,
      requirement,
      repoDir,
      client,
      usage: tally,
      levels: levelsFromReportCard(null),
    });
    return { result, prompts };
  }

  it("assembles a schema-valid blind-first review with the empty T13 parts", async () => {
    const { result } = await review([goodClaim, invented]);
    expect(ReviewSchema.safeParse(result).success).toBe(true);
    expect(result.mode).toBe("blind-first");
    expect(result.expectation).toEqual(expectation);
    expect(result.reviewer.promptVersions).toEqual({
      a1: "a1.v1",
      a2: "a2.v1",
      a3: "none",
      a4: "none",
      a5: "none",
    });
    expect(result.findings).toEqual([]);
    expect(result.refusals).toEqual([]);
    expect(result.retractions).toEqual([]);
    expect(result.receiptDraft).toEqual({
      checked: [],
      notChecked: [],
      residualRisk: { text: "", acceptedRefusalIds: [] },
    });
    // git lists README.md before src/, so the docs hunk is h1.
    expect(result.hunks.map((hunk) => [hunk.id, hunk.file])).toEqual([
      ["h1", "README.md"],
      ["h2", "src/Resolver.cs"],
    ]);
    expect(result.run.id).toMatch(/^\d{8}T\d{6}Z$/);
  });

  it("gives ids in output order, keeps the invented claim as unverified and records its failure", async () => {
    const { result } = await review([goodClaim, invented]);
    expect(result.claims.map((claim) => [claim.id, claim.level])).toEqual([
      ["c1", "supported"],
      ["c2", "unverified"],
    ]);
    expect(result.quoteCheck).toMatchObject({ checked: 2, passed: 1, downgraded: 1, dropped: 0 });
    expect(result.quoteCheck.failures).toEqual([
      {
        itemId: "c2",
        citation: invented.citations[0],
        reason: "quote not found in lines 3–3 of the new file",
      },
    ]);
  });

  it("routes the recorded review: the supported hunk is covered, the docs hunk without a claim is read", async () => {
    const { result } = await review([goodClaim]);
    expect(result.routing.coverage).toEqual({ h1: "read", h2: "supported" });
    expect(result.routing.tier).toBe("focused");
  });

  it("never sends the author description to the model", async () => {
    const { prompts } = await review([goodClaim]);
    expect(prompts).toHaveLength(2);
    for (const prompt of prompts) expect(prompt).not.toContain("AUTHOR-DESCRIPTION-TEXT");
  });

  it("sends A2 the expectation, the head file with line numbers and the hunks", async () => {
    const { prompts } = await review([goodClaim]);
    expect(prompts[0]).not.toContain("<hunks>");
    expect(prompts[1]).toContain("<expectation>");
    expect(prompts[1]).toContain("    3|     int Count = 0;");
    expect(prompts[1]).toContain('<hunk id="h2" file="src/Resolver.cs"');
  });

  it("fails the call, writing nothing, when the answer names a hunk that is not in the diff", async () => {
    await expect(review([{ ...goodClaim, hunkIds: ["h9"] }])).rejects.toThrow(/unknown hunk id/);
  });

  it("feeds checkReview: every code hunk claimed, expectation complete", async () => {
    const { result } = await review([goodClaim]);
    // The README hunk h1 is docs, so one claim on the source hunk h2 covers every non-docs hunk.
    expect(checkReview(result).map((check) => [check.name, check.passed])).toEqual([
      ["A1 covers every requirement item exactly once", true],
      ["A2 lists every hunk of a non-docs file in a claim", true],
    ]);
  });
});
