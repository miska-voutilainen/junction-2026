import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import type { ModelClient } from "../../ai/client";
import type { Requirement, Review } from "../../contracts";
import { loadDiff } from "../../lib/git";
import type { TestRunRequest } from "./dockerArguments";
import type { DotnetRunner } from "./dotnetRunner";
import { runDifferentialTests, type DifferentialTestsInput } from "./runDifferentialTests";

const requirement: Requirement = {
  id: "MP-1",
  title: "Count items",
  intent: "The resolver counts items.",
  functional: [{ id: "F1", text: "It counts from zero." }],
  nonFunctional: [{ id: "N1", text: "No other behaviour changes. (inferred)" }],
  derivedFrom: { kind: "github-issue", url: "https://example.test/1", note: "n" },
};

const expectation = {
  items: [...requirement.functional, ...requirement.nonFunctional].map((item) => ({
    requirementItemId: item.id,
    expectedBehaviours: ["Behaves."],
    likelyAreas: [],
    expectedTests: [],
  })),
};

const generatedCode = "class A5Tests { [Fact] public void A5_F1_StartsAtZero() { } }";
const answer = {
  testFile: "tests/X.Tests/A5_F1.cs",
  code: generatedCode,
  testNames: ["A5_F1_StartsAtZero"],
  requirementItemId: "F1",
};

let repoDir: string;
let input: DifferentialTestsInput;
let seenRequests: TestRunRequest[];
let prompts: string[];
const restoredWithA5File: boolean[] = [];

function git(...args: string[]): string {
  return execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.test", ...args], {
    cwd: repoDir,
    encoding: "utf8",
  }).trim();
}

function write(path: string, text: string) {
  mkdirSync(join(repoDir, path, ".."), { recursive: true });
  writeFileSync(join(repoDir, path), text);
}

/** Base: the resolver counts from one. Head: from zero, plus a new test of the PR's own. */
beforeAll(async () => {
  repoDir = mkdtempSync(join(tmpdir(), "countersign-a5-"));
  git("init", "-q");
  write("src/Resolver.cs", "class Resolver\n{\n    int Count = 1;\n}\n");
  write("tests/X.Tests/X.Tests.csproj", "<Project />\n");
  write(
    "tests/X.Tests/CountTests.cs",
    "class CountTests\n{\n    [Fact]\n    public void Old()\n    {\n    }\n}\n",
  );
  git("add", ".");
  git("commit", "-qm", "base");
  const baseSha = git("rev-parse", "HEAD");
  write("src/Resolver.cs", "class Resolver\n{\n    int Count = 0;\n}\n");
  write(
    "tests/X.Tests/CountTests.cs",
    "class CountTests\n{\n    [Fact]\n    public void Old()\n    {\n    }\n    [Fact]\n    public void PrOwn()\n    {\n    }\n}\n",
  );
  git("add", ".");
  git("commit", "-qm", "head");
  const headSha = git("rev-parse", "HEAD");
  const loaded = await loadDiff(repoDir, baseSha, headSha);
  const resolverHunk = loaded.hunks.find((hunk) => hunk.file === "src/Resolver.cs");
  const claim = (id: string, itemId: string): Review["claims"][number] => ({
    id,
    requirementItemId: itemId,
    text: `Claim ${id}`,
    kind: "behaviour",
    level: "supported",
    hunkIds: [resolverHunk!.id],
    citations: [],
    evidence: [],
  });
  seenRequests = [];
  prompts = [];
  const client: ModelClient = {
    async call(request) {
      prompts.push(request.prompt);
      return request.schema.parse(answer);
    },
  };
  // The fake dotnet "passes" the PR's test everywhere and A5's test only where the resolver counts from zero.
  const runner: DotnetRunner = {
    ensureReady: async () => undefined,
    restore: async (request) => {
      // Restore must run before a model-written file is in the worktree.
      restoredWithA5File.push(existsSync(join(request.worktreeDir, "tests/X.Tests/A5_F1.cs")));
    },
    test: async (request) => {
      seenRequests.push(request);
      const source = readFileSync(join(request.worktreeDir, "src/Resolver.cs"), "utf8");
      const hasA5File = existsSync(join(request.worktreeDir, "tests/X.Tests/A5_F1.cs"));
      const result = hasA5File && !source.includes("Count = 0") ? "fail" : "pass";
      return { result, output: `${result} in ${request.testNames.join(",")}` };
    },
  };
  input = {
    repoDir,
    change: { baseSha, headSha },
    requirement,
    expectation,
    claims: [claim("c1", "F1"), claim("c2", "N1")],
    files: loaded.files,
    hunks: loaded.hunks,
    client,
    runIndex: 0,
    runner,
  };
});

describe("runDifferentialTests", () => {
  it("verifies the claim of the item whose A5 test fails on the base and passes on the head", async () => {
    const { claims, retractions, counts } = await runDifferentialTests(input);
    const [first, second] = claims;
    expect(first.level).toBe("verified");
    expect(first.evidence[0]).toMatchObject({
      kind: "differential-test",
      testName: "A5_F1_StartsAtZero",
      base: { result: "fail" },
      head: { result: "pass" },
    });
    // N1 is not functional, so it has no A5 test of its own and keeps its level; the PR's own test is evidence for both.
    expect(second.level).toBe("supported");
    expect(second.evidence.map((evidence) => evidence.kind)).toEqual(["pr-test"]);
    expect(retractions).toEqual([]);
    expect(counts["tells-apart"]).toBe(1);
  });

  it("asks A5 for functional items only, and shows no code of the change", async () => {
    prompts.length = 0;
    await runDifferentialTests(input);
    expect(prompts).toHaveLength(1);
    expect(prompts.every((prompt) => !prompt.includes("Count = 0"))).toBe(true);
    expect(prompts[0]).toContain("tests/X.Tests/CountTests.cs");
  });

  it("runs the PR's own test with only the PR's test files on the base, after A5's tests", async () => {
    seenRequests.length = 0;
    await runDifferentialTests(input);
    const prRuns = seenRequests.filter((request) => request.testNames.includes("PrOwn"));
    expect(prRuns).toHaveLength(2);
    expect(seenRequests.at(-2)).toBe(prRuns[0]);
  });

  it("removes its worktrees and leaves the clone clean", async () => {
    await runDifferentialTests(input);
    expect(git("worktree", "list").split("\n")).toHaveLength(1);
    expect(git("status", "--porcelain")).toBe("");
  });

  it("removes the worktrees when a run throws", async () => {
    const failing: DotnetRunner = {
      ...input.runner,
      test: async () => {
        throw new Error("runner broke");
      },
    };
    await expect(runDifferentialTests({ ...input, runner: failing })).rejects.toThrow(
      "runner broke",
    );
    expect(git("worktree", "list").split("\n")).toHaveLength(1);
  });

  it("restores both worktrees before any model-written file is added", async () => {
    restoredWithA5File.length = 0;
    await runDifferentialTests(input);
    expect(restoredWithA5File).toEqual([false, false]);
  });

  it("stops before any model call when the runner is not ready", async () => {
    prompts.length = 0;
    const notReady: DotnetRunner = {
      ...input.runner,
      ensureReady: async () => {
        throw new Error("Docker is not running. Start Docker Desktop, or run with --no-tests.");
      },
    };
    await expect(runDifferentialTests({ ...input, runner: notReady })).rejects.toThrow(
      "Docker is not running",
    );
    expect(prompts).toEqual([]);
  });

  it("reports a PR test file of another test project as not run", async () => {
    const files = [
      ...input.files,
      {
        path: "tests/Other.Tests/B.cs",
        kind: "test" as const,
        area: null,
        added: 1,
        removed: 0,
        hunkIds: [],
      },
    ];
    const result = await runDifferentialTests({ ...input, files });
    expect(result.inconclusiveTests).toContainEqual({
      source: "pr-test",
      requirementItemId: null,
      testNames: ["tests/Other.Tests/B.cs"],
      reason: "in another test project, not run",
    });
  });

  it("changes nothing when the change touches no test project", async () => {
    const files = input.files.filter((file) => !file.path.startsWith("tests/"));
    const result = await runDifferentialTests({ ...input, files });
    expect(result.claims).toEqual(input.claims);
  });
});
