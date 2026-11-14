// Tests for quality-on-stop.mjs: the dry-run cases from docs/setup.md 4.4.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { changedSourceFiles, checksFor } from "./quality-on-stop.mjs";

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
  assert.deepEqual(names, ["typecheck", "unit tests"]);
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
