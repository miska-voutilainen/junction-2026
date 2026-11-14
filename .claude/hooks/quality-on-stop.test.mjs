// Tests for quality-on-stop.mjs: the dry-run cases from docs/setup.md 4.4.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { changedSourceFiles, checksFor, firstFailure, trimReport } from "./quality-on-stop.mjs";

test("lists files inside a new folder (git status -uall) and skips deleted and non-source files", () => {
  const porcelain =
    " M src/a.ts\n?? src/new/b.tsx\n?? src/new/c.ts\n D src/gone.ts\n M README.md\nR  old.ts -> src/renamed.ts";
  assert.deepEqual(changedSourceFiles(porcelain), [
    "src/a.ts",
    "src/new/b.tsx",
    "src/new/c.ts",
    "src/renamed.ts",
  ]);
});

test("no changed source files means no checks", () => {
  assert.deepEqual(checksFor(changedSourceFiles(" M README.md\n?? docs/new.md")), []);
});

test("TypeScript changes run typecheck, then the related tests", () => {
  const names = checksFor(["src/a.ts"]).map((check) => check.name);
  assert.deepEqual(names, ["typegen", "typecheck", "unit tests"]);
});

test("hook changes run the hook tests", () => {
  assert.deepEqual(
    checksFor([".claude/hooks/guard.mjs"]).map((check) => check.name),
    ["hook tests"],
  );
});

test("stop_hook_active exits silently so a block cannot loop", () => {
  const script = resolve(dirname(fileURLToPath(import.meta.url)), "quality-on-stop.mjs");
  const run = spawnSync("node", [script], {
    input: JSON.stringify({ stop_hook_active: true }),
    encoding: "utf8",
  });
  assert.equal(run.status, 0);
  assert.equal(run.stdout, "");
});

test("many changed files fall back to the full test run", () => {
  const files = Array.from({ length: 40 }, (_, index) => `src/f${index}.ts`);
  const tests = checksFor(files).find((check) => check.name === "unit tests");
  assert.deepEqual(tests.args, ["run"]);
});

test("a long report keeps the tail from the first failure, not the start", () => {
  const output = `${"passing line\n".repeat(2000)}FAIL src/a.test.ts\nexpected 1 to be 2`;
  const report = trimReport(output);
  assert.ok(report.startsWith("FAIL src/a.test.ts"));
  assert.ok(report.length <= 4000);
  assert.ok(trimReport("x".repeat(9000) + "end").endsWith("end"));
});

const completed = { ran: true, ok: true, failed: false, output: "" };
const farAway = Date.now() + 60_000;

test("typecheck is skipped when typegen did not run, so a missing route-types folder never blocks", () => {
  const seen = [];
  const run = (check) => {
    seen.push(check.name);
    if (check.name === "typegen") return { ...completed, ran: false, ok: false };
    return { ...completed, ok: false, failed: true, output: "FAIL" };
  };
  const reason = firstFailure(checksFor(["src/a.ts"]), run, farAway);
  assert.deepEqual(seen, ["typegen", "unit tests"]);
  assert.match(reason, /^unit tests failed/);
});

test("typecheck runs after a completed typegen and its failure blocks", () => {
  const run = (check) =>
    check.name === "typecheck"
      ? { ...completed, ok: false, failed: true, output: "error TS2322" }
      : completed;
  assert.match(
    firstFailure(checksFor(["src/a.ts"]), run, farAway),
    /^typecheck failed: error TS2322/,
  );
});
