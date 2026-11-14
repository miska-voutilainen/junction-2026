// PostToolUse hook (docs/setup.md 4.3): after every Edit, Write or MultiEdit, format the file,
// autofix lint, then flag the polish mistakes a reviewer would otherwise catch later. Findings go
// back to the agent as a block decision so it fixes them in the same turn.
import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { runCommand, runNodeTool } from "./runCommand.mjs";

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
  /(^|\/)(node_modules|\.next|\.scratch|\.review|graphify-out)\/|^data\/(recordings|runs)\//;
const PRETTIER = "prettier/bin/prettier.cjs";
const ESLINT = "eslint/bin/eslint.js";
const REPORT_LIMIT = 4000;
// The hook is registered with a 60 s timeout; stay under it so a slow tool never gets it killed mid-report.
const TOTAL_DEADLINE_MS = 50_000;

/** Milliseconds left of a deadline, at least 1 (a timeout of 0 means "no limit" to spawn). */
function timeLeft(deadline) {
  return Math.max(1, deadline - Date.now());
}

/** True for files a person reads in the browser: UI source that is neither tokens nor a test. */
export function isUiFile(relPath) {
  return (
    UI_EXTENSIONS.has(extname(relPath)) &&
    relPath.startsWith("src/") &&
    relPath !== "src/styles/tokens.css" &&
    !/\.test\.[tj]sx?$/.test(relPath)
  );
}

/**
 * Drops what is not a visible value: comments, `var(--token)` references, `href="#anchor"` and
 * custom-property definitions (`--bg: #fff` is how a token is defined, so it is allowed).
 */
function stripNonValues(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`\w])\/\/.*$/gm, "$1") // a `//` right after `:` is a URL scheme, not a comment
    .replace(/--[\w-]+\s*:\s*[^;}\n]*/g, "")
    .replace(/var\(--[\w-]+\)/g, "")
    .replace(/href=(["'])#[^"']*\1/g, "");
}

// A colour follows `:`, `[`, `(`, `,` or a quote, or sits after a space or `_` inside a value
// (`1px solid #fff`, Tailwind `shadow-[0_0_0_1px_#000]`). After a space only 3, 6 or 8 digits count,
// so "ticket #1234" in copy and `&#8212;` do not match.
const COLOUR_LITERAL =
  /(?:[:[(,]|["'`])\s*#[0-9a-fA-F]{3,8}\b|[\s_]#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b|\brgba?\(|\bhsla?\(/;

const POLISH_CHECKS = [
  { name: "colour literal (use a design token)", pattern: COLOUR_LITERAL },
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

/** Walks up from a file to the folder holding `.git`, so an edit in a worktree is checked with that worktree's tools. */
export function projectRootOf(absoluteFile, fallbackRoot) {
  for (let folder = dirname(absoluteFile); dirname(folder) !== folder; folder = dirname(folder)) {
    if (existsSync(join(folder, ".git"))) return folder;
  }
  return fallbackRoot;
}

/**
 * True when running prettier on the file would only change what this edit changed: the file is new,
 * or its committed version is already prettier-clean. The repo was never bulk-formatted, so
 * formatting any other file would rewrite lines the edit never touched.
 */
export function isSafeToFormat(root, relPath, deadline = Date.now() + TOTAL_DEADLINE_MS) {
  const committed = runCommand("git", ["show", `HEAD:${relPath}`], {
    cwd: root,
    timeoutMs: timeLeft(deadline),
  });
  if (!committed.ran) return false;
  if (!committed.ok) return true; // not in HEAD: a new file
  const check = runNodeTool(root, PRETTIER, ["--check", "--stdin-filepath", relPath], {
    timeoutMs: timeLeft(deadline),
    input: committed.stdout, // untrimmed: the final newline is part of what prettier checks
  });
  return check.ok;
}

function formatAndLint(root, relPath, deadline) {
  const extension = extname(relPath);
  if (FORMATTED_EXTENSIONS.has(extension) && isSafeToFormat(root, relPath, deadline)) {
    runNodeTool(root, PRETTIER, ["--write", relPath], { timeoutMs: timeLeft(deadline) });
  }
  if (!LINTED_EXTENSIONS.has(extension)) return [];
  const lint = runNodeTool(root, ESLINT, ["--fix", relPath], { timeoutMs: timeLeft(deadline) });
  return lint.failed ? [`lint: ${lint.output}`] : [];
}

/**
 * Formats, lints and polish-checks one edited file.
 * @returns {string[]} findings; empty when the file is clean, not ours to check, or a tool could not run
 */
export function checkEditedFile(fallbackRoot, filePath) {
  const absolute = resolve(fallbackRoot, filePath);
  if (!existsSync(absolute)) return [];
  const root = projectRootOf(absolute, fallbackRoot);
  const relPath = relative(root, absolute).replaceAll("\\", "/");
  if (relPath.startsWith("..") || SKIPPED_PATH.test(relPath)) return [];
  const findings = formatAndLint(root, relPath, Date.now() + TOTAL_DEADLINE_MS);
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
