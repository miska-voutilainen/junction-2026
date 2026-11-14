// PostToolUse hook (docs/setup.md 4.3): after every Edit, Write or MultiEdit, format the file,
// autofix lint, then flag the polish mistakes a reviewer would otherwise catch later. Findings go
// back to the agent as a block decision so it fixes them in the same turn.
import { existsSync, readFileSync } from "node:fs";
import { extname, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { quotePath, runCommand } from "./runCommand.mjs";

const FORMATTED_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".json",
  ".css",
  ".md",
]);
const LINTED_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs"]);
const UI_EXTENSIONS = new Set([".tsx", ".jsx", ".css"]);
const SKIPPED_PATH =
  /(^|\/)(node_modules|\.next|\.scratch|\.review|graphify-out|\.claude\/worktrees)\/|^data\/(recordings|runs)\/|pnpm-lock\.yaml$/;
const REPORT_LIMIT = 4000;
const TOOL_TIMEOUT_MS = 25_000;

/** True for files a person reads in the browser: UI source that is neither tokens nor a test. */
export function isUiFile(relPath) {
  return (
    UI_EXTENSIONS.has(extname(relPath)) &&
    relPath.startsWith("src/") &&
    relPath !== "src/styles/tokens.css" &&
    !/\.test\.[tj]sx?$/.test(relPath)
  );
}

/** Drops comments, `var(--token)` references and `href="#anchor"` so the checks see only real values. */
function stripNonValues(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`\w])\/\/.*$/gm, "$1") // a `//` right after `:` is a URL scheme, not a comment
    .replace(/var\(--[\w-]+\)/g, "")
    .replace(/href=(["'])#[^"']*\1/g, "");
}

const POLISH_CHECKS = [
  {
    name: "colour literal (use a design token)",
    pattern: /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/,
  },
  {
    name: "raw pixel font size (use a type token)",
    pattern: /font-?size["']?\s*:\s*["']?\d+|text-\[\d+px\]/i,
  },
  { name: "lorem ipsum", pattern: /lorem ipsum/i },
  {
    name: "TODO or FIXME in user-visible text",
    pattern: />[^<>{}\n]*\b(TODO|FIXME)\b|(["'`])[^"'`\n]*\b(TODO|FIXME)\b[^"'`\n]*\2/,
  },
  { name: "image without alt text", pattern: /<img\b(?![^>]*\balt=)[^>]*>/ },
  {
    name: "clickable element without a role (use a button or link)",
    pattern: /<(?:div|span|li|p|section)\b(?![^>]*\brole=)[^>]*\bonClick=/,
  },
];

/**
 * Names the polish mistakes found in UI source text.
 * Example: `<img src="a.png" />` gives `["image without alt text"]`; `// TODO(#12)` gives `[]`.
 * @param {string} text file content
 * @returns {string[]} one entry per failed check
 */
export function polishFindings(text) {
  const visible = stripNonValues(text);
  return POLISH_CHECKS.filter((check) => check.pattern.test(visible)).map((check) => check.name);
}

function formatAndLint(root, relPath) {
  const extension = extname(relPath);
  if (FORMATTED_EXTENSIONS.has(extension)) {
    runCommand(`pnpm exec prettier --write ${quotePath(relPath)}`, {
      cwd: root,
      timeoutMs: TOOL_TIMEOUT_MS,
    });
  }
  if (!LINTED_EXTENSIONS.has(extension)) return [];
  const lint = runCommand(`pnpm exec eslint --fix ${quotePath(relPath)}`, {
    cwd: root,
    timeoutMs: TOOL_TIMEOUT_MS,
  });
  return lint.ok ? [] : [`lint: ${lint.output}`];
}

/**
 * Formats, lints and polish-checks one edited file.
 * @returns {string[]} findings; empty when the file is clean or not ours to check
 */
export function checkEditedFile(root, filePath) {
  const absolute = resolve(root, filePath);
  const relPath = relative(root, absolute).replaceAll("\\", "/");
  if (relPath.startsWith("..") || SKIPPED_PATH.test(relPath) || !existsSync(absolute)) return [];
  const findings = formatAndLint(root, relPath);
  if (isUiFile(relPath))
    findings.push(
      ...polishFindings(readFileSync(absolute, "utf8")).map((name) => `polish: ${name}`),
    );
  return findings;
}

function main() {
  let input = {};
  try {
    const text = readFileSync(0, "utf8").replace(/^﻿/, "");
    if (text.trim()) input = JSON.parse(text);
  } catch {
    return; // unreadable input: never block an edit because the hook could not parse its stdin
  }
  const filePath = input.tool_input?.file_path;
  if (!filePath) return;
  const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
  const findings = checkEditedFile(root, filePath);
  if (findings.length === 0) return;
  const shown = relative(root, resolve(root, filePath)).replaceAll("\\", "/");
  process.stdout.write(
    JSON.stringify({
      decision: "block",
      reason: `${shown}: ${findings.join("; ")}`.slice(0, REPORT_LIMIT),
    }),
  );
}

const self = process.argv[1] ? pathToFileURL(process.argv[1]).href.toLowerCase() : "";
if (import.meta.url.toLowerCase() === self) main();
