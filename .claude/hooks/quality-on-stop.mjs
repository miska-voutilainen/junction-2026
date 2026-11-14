// Stop hook (docs/setup.md 4.4): before the agent ends its turn, typecheck and run the tests
// related to what it changed. A failure blocks the stop with the error, so broken work is fixed
// in the same turn instead of surfacing in CI. E2E, evals and screenshots are too slow here.
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { quotePath, runCommand } from "./runCommand.mjs";

const TS_SOURCE = /\.(ts|tsx)$/;
const SOURCE = /\.(ts|tsx|mjs|js|jsx|css)$/;
const HOOK_FILE = /^\.claude\/hooks\//;
const REPORT_LIMIT = 4000;
const CHECK_TIMEOUT_MS = 80_000;

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
 * Chooses the checks a set of changed files needs, in the order they run.
 * @returns {{ name: string, command: string }[]}
 */
export function checksFor(files) {
  const typeScript = files.filter((file) => TS_SOURCE.test(file));
  const checks = [];
  if (typeScript.length > 0) {
    checks.push({ name: "typecheck", command: "pnpm typecheck" });
    checks.push({
      name: "unit tests",
      command: `pnpm exec vitest related --run --passWithNoTests ${typeScript.map(quotePath).join(" ")}`,
    });
  }
  if (files.some((file) => HOOK_FILE.test(file)))
    checks.push({ name: "hook tests", command: "pnpm test:hooks" });
  return checks;
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
  const status = runCommand("git status --porcelain -uall", { cwd: root, timeoutMs: 10_000 });
  for (const check of checksFor(changedSourceFiles(status.output.replace(/\r/g, "")))) {
    const result = runCommand(check.command, { cwd: root, timeoutMs: CHECK_TIMEOUT_MS });
    if (result.ok) continue;
    process.stdout.write(
      JSON.stringify({
        decision: "block",
        reason: `${check.name} failed: ${result.output}`.slice(0, REPORT_LIMIT),
      }),
    );
    return;
  }
}

const self = process.argv[1] ? pathToFileURL(process.argv[1]).href.toLowerCase() : "";
if (import.meta.url.toLowerCase() === self) main();
