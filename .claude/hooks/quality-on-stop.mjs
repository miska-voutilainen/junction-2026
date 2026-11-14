// Stop hook (docs/setup.md 4.4): before the agent ends its turn, typecheck and run the tests
// related to what it changed. A failure blocks the stop with the error, so broken work is fixed
// in the same turn instead of surfacing in CI. E2E, evals and screenshots are too slow here.
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { runCommand, runNodeTool } from "./runCommand.mjs";

const TS_SOURCE = /\.(ts|tsx)$/;
const SOURCE = /\.(ts|tsx|mjs|js|jsx|css)$/;
const HOOK_FILE = /^\.claude\/hooks\//;
const REPORT_LIMIT = 4000;
// setup.md 4.4 keeps the whole hook near 90 s; the registered timeout is 180 s, so there is headroom.
const TOTAL_DEADLINE_MS = 85_000;
// Past this many files, a full run costs about the same as `vitest related` and cannot miss a test.
const RELATED_FILE_LIMIT = 30;

/**
 * Lists changed, still-existing source files from `git status --porcelain -uall` output.
 * `-uall` is required: without it a new folder shows as one line and its files are missed.
 * Example: `" M src/a.ts\n?? src/new/b.tsx\n D src/gone.ts"` gives `["src/a.ts", "src/new/b.tsx"]`.
 */
export function changedSourceFiles(porcelain) {
  return porcelain
    .split("\n")
    .filter((line) => line.length > 3 && !line.slice(0, 2).includes("D"))
    .map((line) =>
      line
        .slice(3)
        .replace(/^.* -> /, "")
        .replace(/^"|"$/g, ""),
    )
    .filter((path) => SOURCE.test(path));
}

/**
 * Chooses the checks a set of changed files needs, in the order they run. Each check is a Node
 * tool (`script` inside node_modules) or plain Node (`script` null) with its arguments.
 * `failureStatuses` lists the exit codes that mean "ran and found problems".
 * A check with `prerequisiteOf` never blocks; if it does not complete, the check it names is skipped.
 * @returns {{ name: string, script: string | null, args: string[], failureStatuses: number[], prerequisiteOf?: string }[]}
 */
export function checksFor(files) {
  const typeScript = files.filter((file) => TS_SOURCE.test(file));
  const checks = [];
  if (typeScript.length > 0) {
    // `next typegen` writes the route types (PageProps, LayoutProps) the app imports. A checkout
    // without .next/types fails the typecheck with errors the agent cannot fix, so it runs first.
    checks.push({
      name: "typegen",
      script: "next/dist/bin/next",
      args: ["typegen"],
      failureStatuses: [],
      prerequisiteOf: "typecheck",
    });
    // tsc exits 2 when it reports errors without emitting, 1 when it also skips output.
    checks.push({
      name: "typecheck",
      script: "typescript/bin/tsc",
      args: ["--noEmit"],
      failureStatuses: [1, 2],
    });
    const related =
      typeScript.length > RELATED_FILE_LIMIT
        ? ["run"]
        : ["related", "--run", "--passWithNoTests", ...typeScript];
    checks.push({
      name: "unit tests",
      script: "vitest/vitest.mjs",
      args: related,
      failureStatuses: [1],
    });
  }
  if (files.some((file) => HOOK_FILE.test(file))) {
    checks.push({
      name: "hook tests",
      script: null,
      args: ["--test", ".claude/hooks/**/*.test.mjs"],
      failureStatuses: [1],
    });
  }
  return checks;
}

/** Keeps the useful end of a long report: from the first `FAIL` or `error` line, else the last characters. */
export function trimReport(output) {
  const firstProblem = output.search(/\bFAIL\b|error TS|✖|^not ok /m);
  const relevant = firstProblem >= 0 ? output.slice(firstProblem) : output;
  return relevant.length <= REPORT_LIMIT ? relevant : relevant.slice(-REPORT_LIMIT);
}

function runCheck(root, check, timeoutMs) {
  const options = { timeoutMs, failureStatuses: check.failureStatuses };
  if (check.script) return runNodeTool(root, check.script, check.args, options);
  return runCommand(process.execPath, check.args, { cwd: root, ...options });
}

/**
 * Runs the checks in order inside one deadline and returns the first failure as a report, or null.
 * A prerequisite that did not complete skips the check it names instead of blocking on noise.
 * @param {(check: object, timeoutMs: number) => { ran: boolean, ok: boolean, failed: boolean, output: string }} run
 */
export function firstFailure(checks, run, deadline) {
  const skipped = new Set();
  for (const check of checks) {
    if (skipped.has(check.name)) continue;
    const timeLeft = deadline - Date.now();
    if (timeLeft <= 0) return null; // out of budget: skipping beats a hook the platform kills mid-report
    const result = run(check, timeLeft);
    if (check.prerequisiteOf && !result.ok) skipped.add(check.prerequisiteOf);
    if (result.failed) return `${check.name} failed: ${trimReport(result.output)}`;
  }
  return null;
}

function main() {
  let input = {};
  try {
    const text = readFileSync(0, "utf8").replace(/^﻿/, "");
    if (text.trim()) input = JSON.parse(text);
  } catch {
    return;
  }
  if (input.stop_hook_active) return; // the agent is already fixing a block: never loop
  const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
  const status = runCommand("git", ["status", "--porcelain", "-uall"], {
    cwd: root,
    timeoutMs: 10_000,
  });
  if (!status.ran) return;
  const checks = checksFor(changedSourceFiles(status.output.replaceAll("\r", "")));
  const reason = firstFailure(
    checks,
    (check, timeoutMs) => runCheck(root, check, timeoutMs),
    Date.now() + TOTAL_DEADLINE_MS,
  );
  if (reason) process.stdout.write(JSON.stringify({ decision: "block", reason }));
}

const self = process.argv[1] ? pathToFileURL(process.argv[1]).href.toLowerCase() : "";
if (import.meta.url.toLowerCase() === self) main();
