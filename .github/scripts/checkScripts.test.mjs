// Tests for the pure functions behind the three CI checks.
import assert from "node:assert/strict";
import { test } from "node:test";
import { findLaneViolations, summarise } from "./checkLanes.mjs";
import { findMessageProblems } from "./checkMessages.mjs";
import { findVersionProblem, readsIntoPrompt } from "./checkReviewerVersion.mjs";
import { findChangeId } from "./countersignChange.mjs";
import { compareLevels, renderLevelTable } from "./levelDiff.mjs";
import { bannedSegment, findTreeProblems, readRootNames } from "./checkTree.mjs";

const config = {
  lanes: {
    engine: { owner: "miska-voutilainen", paths: ["src/ai/**"] },
    app: { owner: "miska-voutilainen", coOwners: ["eliasnorta"], paths: ["src/app/**"] },
    evidence: { owner: "Kasanen", paths: ["scripts/**"] },
  },
  shared: ["package.json", ".github/**"],
  open: ["docs/**", "README.md"],
};

test("messages: clean texts pass", () => {
  assert.deepEqual(
    findMessageProblems({ title: "feat: x", body: "Closes #6", commits: ["fix: y\n\nbody"] }),
    [],
  );
});

test("messages: emoji, shortcode and AI trailer are named with where they are", () => {
  const problems = findMessageProblems({
    title: "feat: ship \u{1F680}",
    body: "done :tada:",
    commits: ["fix: y\n\nCo-Authored-By: Claude <noreply@anthropic.com>"],
  });
  assert.equal(problems.length, 3);
  assert.match(problems[0], /^PR title/);
  assert.match(problems[1], /^PR body/);
  assert.match(problems[2], /^commit "fix: y"/);
});

test("lanes: an owner of two lanes may touch both", () => {
  const files = ["src/ai/client.ts", "src/app/page.tsx", "docs/setup.md"];
  assert.deepEqual(
    findLaneViolations({ files, author: "miska-voutilainen", labels: [], config }),
    [],
  );
});

test("lanes: a co-owner owns that lane and only that lane", () => {
  const files = ["src/app/page.tsx", "src/ai/client.ts"];
  const violations = findLaneViolations({ files, author: "EliasNorta", labels: [], config });
  assert.deepEqual(
    violations.map((violation) => violation.path),
    ["src/ai/client.ts"],
  );
});

test("lanes: another lane's and shared paths fail without the label", () => {
  const files = ["scripts/seed.ts", "package.json", "README.md"];
  const violations = findLaneViolations({ files, author: "miska-voutilainen", labels: [], config });
  assert.deepEqual(
    violations.map((v) => v.path),
    ["scripts/seed.ts", "package.json"],
  );
});

test("lanes: the cross-lane label clears the violations", () => {
  const files = ["scripts/seed.ts", "package.json"];
  assert.deepEqual(
    findLaneViolations({ files, author: "Elias", labels: ["cross-lane"], config }),
    [],
  );
});

test("lanes: the summary names the lanes touched", () => {
  assert.match(
    summarise({ files: ["src/ai/a.ts", "package.json"], config, author: "x" }),
    /Lanes touched: engine, shared/,
  );
  assert.match(summarise({ files: ["docs/a.md"], config, author: "x" }), /none/);
});

const claudeMd = [
  "## File tree",
  "```text",
  ".",
  "├── README.md, CLAUDE.md",
  "├── package.json,",
  "│   next.config.ts, .prettierrc.json",
  "├── .github/      workflows/, scripts/",
  "├── src/",
  "│   ├── app/                    routes",
  "└── docs/         challenge, spec",
  "```",
].join("\n");

test("tree: reads root files and folders from CLAUDE.md", () => {
  const { folders, files } = readRootNames(claudeMd);
  assert.deepEqual([...folders].sort(), [".github", "docs", "src"]);
  assert.ok(files.has("README.md") && files.has("next.config.ts") && files.has(".prettierrc.json"));
  assert.ok(!files.has("app/"));
});

test("tree: stray root files, unknown folders, scratch output and banned names are named", () => {
  const files = [
    "README.md",
    "notes.txt",
    "extras/a.ts",
    ".scratch/draft.md",
    "src/lib/utils2.ts",
    "src/CopyButton.tsx",
    "vitest.config.ts",
  ];
  const problems = findTreeProblems(files, claudeMd);
  assert.equal(problems.length, 4);
  assert.match(problems.join("\n"), /notes\.txt: not an allowed root file/);
  assert.match(problems.join("\n"), /extras\/: not a top-level folder/);
  assert.match(problems.join("\n"), /\.scratch\/draft\.md/);
  assert.match(problems.join("\n"), /"utils2"/);
});

test("tree: banned names match whole segments, not substrings", () => {
  assert.equal(bannedSegment("src/old.ts"), "old");
  assert.equal(bannedSegment("a/helpers-new.ts"), "helpers-new");
  assert.equal(bannedSegment("src/temperature.ts"), undefined);
  assert.equal(bannedSegment("src/finalize.ts"), undefined);
  assert.equal(bannedSegment("data/recordings/a5.v2-0ab111c4672f9269.json"), undefined);
  assert.equal(bannedSegment("data/runs/notes-v2.json"), "v2");
});

test("lanes: the summary lists paths no lane claims", () => {
  assert.match(
    summarise({ files: ["mystery/a.ts"], config, author: "x" }),
    /Not in any lane.*mystery\/a\.ts/,
  );
  assert.doesNotMatch(summarise({ files: ["docs/a.md"], config, author: "x" }), /Not in any lane/);
});

test("countersign change: reads the id from its own line and ignores the rest of the body", () => {
  assert.equal(findChangeId("[agent:app]\n\nCountersign: mp-2283\n\n## Summary"), "mp-2283");
  assert.equal(findChangeId("Countersign:v03  "), "v03");
});

test("countersign change: no line, or an id that is not plain, is no change", () => {
  assert.equal(findChangeId("Closes #6"), null);
  assert.equal(findChangeId("Countersign: ../../etc/passwd"), null);
  assert.equal(findChangeId("see Countersign: mp-2283 in the body"), null);
});

const card = (...areas) => ({
  areas: areas.map(([area, level, planted, caught]) => ({ area, level, planted, caught })),
});

test("level diff: a lower level is a drop and names the area", () => {
  const result = compareLevels(
    card(["security", "calibrated", 3, 3], ["generator", "calibrated", 4, 3]),
    card(["security", "shadow", 3, 1], ["generator", "calibrated", 4, 3]),
  );
  assert.equal(result.hasDrop, true);
  assert.deepEqual(result.rows[0], {
    area: "security",
    from: "calibrated",
    to: "shadow",
    caught: "1 of 3",
    isDrop: true,
  });
  assert.match(
    renderLevelTable(result),
    /\| security \| 1 of 3 \| calibrated \| shadow \(dropped\) \|/,
  );
});

test("level diff: a rise, no change and a new area pass", () => {
  const result = compareLevels(
    card(["analyzer", "shadow", 2, 1]),
    card(["analyzer", "calibrated", 3, 3], ["performance", "shadow", 0, 0]),
  );
  assert.equal(result.hasDrop, false);
  assert.equal(result.rows[1].from, "shadow");
});

test("reviewer version: only files the model reads count, not their tests", () => {
  assert.equal(readsIntoPrompt("src/prompts/a3.ts"), true);
  assert.equal(readsIntoPrompt("src/policy/areaChecklists.ts"), true);
  assert.equal(readsIntoPrompt("src/prompts/a3.test.ts"), false);
  assert.equal(readsIntoPrompt("src/policy/routing.ts"), false);
});

test("reviewer version: a prompt change without a bump names the files and the fix", () => {
  const problem = findVersionProblem(["src/prompts/a3.ts", "docs/spec.md"], "");
  assert.match(problem, /^src\/prompts\/a3\.ts change what the model reads/);
  assert.match(problem, /Bump it in src\/pipeline\/assembleReview\.ts/);
});

test("reviewer version: a bump, or no prompt change, passes", () => {
  const bump = '-export const reviewerVersion = "rv1";\n+export const reviewerVersion = "rv2";';
  assert.equal(findVersionProblem(["src/prompts/a3.ts"], bump), null);
  assert.equal(findVersionProblem(["src/app/page.tsx"], ""), null);
});
