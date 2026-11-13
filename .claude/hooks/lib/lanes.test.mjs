import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  globToRegExp, matchesGlob, normalisePath, isOutside, classifyPath, lanesTouched, readSetting,
  compareWithClaudeMd, loadLanes,
} from "./lanes.mjs";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const config = loadLanes(repo);

test("globs", () => {
  assert.ok(matchesGlob("next.config.ts", "*.config.*"));
  assert.ok(!matchesGlob("src/next.config.ts", "*.config.*"));
  assert.ok(matchesGlob("src/app/a/b.tsx", "src/app/**"));
  assert.ok(matchesGlob("src/app/x.tsx", "src/app/**"));
  assert.ok(matchesGlob("a/b.ts", "**/b.ts"));
  assert.ok(matchesGlob("b.ts", "**/b.ts"));
  assert.ok(matchesGlob("src/x.ts", "src/**/x.ts"));
  assert.ok(matchesGlob("src/a/b/x.ts", "src/**/x.ts"));
  assert.ok(!matchesGlob("src/a/y.ts", "src/**/x.ts"));
  assert.ok(globToRegExp("a?.ts").test("ab.ts"));
  assert.ok(!globToRegExp("a.ts").test("axts"));
});

test("normalisePath", () => {
  assert.equal(normalisePath("C:\\Repo\\src\\a.ts", "c:/repo"), "src/a.ts");
  assert.equal(normalisePath("c:/Repo/src/a.ts", "C:\\Repo\\"), "src/a.ts");
  assert.equal(normalisePath("/c/Repo/src/a.ts", "C:\\Repo"), "src/a.ts");
  assert.equal(normalisePath("./x", "C:\\Repo"), "x");
  assert.equal(normalisePath("src\\a\\b.ts", "C:\\Repo"), "src/a/b.ts");
  assert.equal(normalisePath("D:\\other\\a.ts", "C:\\Repo"), "D:/other/a.ts");
});

test("isOutside", () => {
  assert.ok(isOutside("../x"));
  assert.ok(isOutside(".."));
  assert.ok(isOutside("D:/other/a.ts"));
  assert.ok(isOutside("/etc/passwd"));
  assert.ok(isOutside("~/x"));
  assert.ok(!isOutside("src/a.ts"));
  assert.ok(!isOutside("..foo/x"));
});

test("classifyPath order", () => {
  const k = (p) => classifyPath(p, config);
  assert.equal(k("docs/spec.md").kind, "shared");
  assert.equal(k("docs/api.md").kind, "open");
  assert.equal(k(".claude/settings.local.json").kind, "local");
  assert.equal(k(".claude/rules/git.md").kind, "shared");
  assert.deepEqual(k("src/rules/route.ts"), { kind: "lane", lane: "engine", owner: "miska-voutilainen" });
  assert.equal(k("e2e/x.spec.ts").lane, "app");
  assert.equal(k("scripts/seed.ts").lane, "evidence");
  assert.equal(k("src/contracts/review.ts").kind, "shared");
  assert.equal(k("next.config.ts").kind, "shared");
  assert.equal(k("foo/bar.ts").kind, "unmatched");
  assert.equal(k("../x").kind, "outside");
});

test("lanesTouched", () => {
  const files = ["src/ai/a.ts", "src/app/p.tsx", "docs/api.md", ".claude/settings.local.json", "package.json", "foo.ts"];
  assert.deepEqual(lanesTouched(files, config), ["app", "engine", "shared"]);
  assert.deepEqual(lanesTouched(["docs/api.md"], config), []);
});

test("readSetting", () => {
  assert.equal(readSetting("LANE", repo, { LANE: " app " }), "app");
  const root = mkdtempSync(join(tmpdir(), "lanes-test-"));
  try {
    mkdirSync(join(root, ".claude"));
    writeFileSync(join(root, ".claude", "settings.local.json"), JSON.stringify({ env: { LANE: "evidence", PLAN: "" } }));
    assert.equal(readSetting("LANE", root, {}), "evidence");
    assert.equal(readSetting("LANE", root, { LANE: "app" }), "app");
    assert.equal(readSetting("LANE", root, { LANE: "" }), "evidence");
    assert.equal(readSetting("PLAN", root, {}), undefined);
    assert.equal(readSetting("SLOT", root, {}), undefined);
    assert.equal(readSetting("LANE", join(root, "missing"), {}), undefined);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("compareWithClaudeMd", () => {
  const md = readFileSync(join(repo, "CLAUDE.md"), "utf8");
  assert.deepEqual(compareWithClaudeMd(config, md), []);
  const changed = structuredClone(config);
  changed.lanes.app.owner = "someone-else";
  const problems = compareWithClaudeMd(changed, md);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /app/);
});

test("normalisePath collapses dot segments", () => {
  assert.equal(normalisePath("src/../.claude/hooks/guard.mjs", "C:/repo"), ".claude/hooks/guard.mjs");
  assert.equal(normalisePath("C:\\repo\\src\\..\\.claude\\x", "c:/repo"), ".claude/x");
  assert.equal(isOutside(normalisePath("src/../..", "C:/repo")), true);
  assert.equal(isOutside(normalisePath("C:/repo/../other/a.ts", "C:/repo")), true);
  assert.equal(normalisePath("./a//b/./c.ts", "C:/repo"), "a/b/c.ts");
  assert.equal(normalisePath("C:/repo", "C:/repo"), "");
});
