// Tests for format-on-edit.mjs: the polish dry-run cases from docs/setup.md 4.3.
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { isSafeToFormat, isUiFile, polishFindings, projectRootOf } from "./format-on-edit.mjs";

const flagged = (source) => polishFindings(source).length > 0;

test("flags a colour literal, a raw pixel font size, lorem ipsum, a TODO in text, an img without alt and a div onClick", () => {
  assert.ok(flagged('const s = { color: "#ff0000" };'));
  assert.ok(flagged("const s = { fontSize: 14 };"));
  assert.ok(flagged("<p>Lorem ipsum dolor sit amet</p>"));
  assert.ok(flagged("<p>TODO write this</p>"));
  assert.ok(flagged('<img src="a.png" />'));
  assert.ok(flagged("<div onClick={go}>Open</div>"));
});

test("does not flag a token colour, a TODO with an issue in a comment, an img with alt, a button onClick or an anchor href", () => {
  assert.deepEqual(polishFindings('const s = { color: "var(--color-fg)" };'), []);
  assert.deepEqual(polishFindings("// TODO(#12) wire the data\nconst a = 1;"), []);
  assert.deepEqual(polishFindings('<img src="a.png" alt="Logo" />'), []);
  assert.deepEqual(polishFindings("<button onClick={go}>Open</button>"), []);
  assert.deepEqual(polishFindings('<a href="#main">Skip to content</a>'), []);
});

test("a div with onClick and a role is allowed", () => {
  assert.deepEqual(polishFindings('<div role="button" onClick={go}>Open</div>'), []);
});

test("polish checks cover UI source only, not tokens, tests or non-UI files", () => {
  assert.ok(isUiFile("src/components/Badge.tsx"));
  assert.ok(!isUiFile("src/styles/tokens.css"));
  assert.ok(!isUiFile("src/components/Badge.test.tsx"));
  assert.ok(!isUiFile("src/rules/route.ts"));
});

test("a run with no file path or unparsable input prints nothing", () => {
  const script = resolve(dirname(fileURLToPath(import.meta.url)), "format-on-edit.mjs");
  for (const input of ["", "not json", "{}"]) {
    const run = spawnSync("node", [script], { input, encoding: "utf8" });
    assert.equal(run.status, 0);
    assert.equal(run.stdout, "");
  }
});

test("CSS custom-property definitions may hold colours; entities and issue numbers in copy are not colours", () => {
  assert.deepEqual(polishFindings("@media print { :root { --surface: #ffffff; --ink: rgb(0 0 0); } }"), []);
  assert.deepEqual(polishFindings("<p>Wait &#8212; see ticket #1234</p>"), []);
  assert.ok(flagged(".card { color: #ff0000; }"));
  assert.ok(flagged('const palette = ["#abc"];'));
});

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

test("formats a file only when it is new or its committed version is already prettier-clean", () => {
  const dir = mkdtempSync(resolve(tmpdir(), "format-hook-"));
  try {
    const git = (...args) => execFileSync("git", args, { cwd: dir, stdio: "pipe" });
    git("init", "-q");
    // A junction (no admin rights needed on Windows) lets the temp repo use the project's prettier.
    symlinkSync(resolve(repoRoot, "node_modules"), resolve(dir, "node_modules"), "junction");
    writeFileSync(resolve(dir, ".prettierrc.json"), "{}");
    writeFileSync(resolve(dir, "clean.ts"), "export const a = 1;\n");
    writeFileSync(resolve(dir, "unclean.ts"), "export   const a=1\n");
    git("add", ".prettierrc.json", "clean.ts", "unclean.ts");
    git("-c", "user.name=t", "-c", "user.email=t@example.com", "commit", "-q", "-m", "init");
    writeFileSync(resolve(dir, "fresh.ts"), "export   const b=2\n");
    assert.equal(isSafeToFormat(dir, "clean.ts"), true);
    assert.equal(isSafeToFormat(dir, "unclean.ts"), false);
    assert.equal(isSafeToFormat(dir, "fresh.ts"), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("projectRootOf finds the worktree that holds the file", () => {
  assert.equal(projectRootOf(resolve(repoRoot, "src/app/page.tsx"), "/elsewhere"), repoRoot);
});
