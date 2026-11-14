// Tree check: judges open the repo, so the tree must read like a table of contents. Root files
// come from the allowlist, top-level folders from the File tree in CLAUDE.md, no file carries a
// throwaway name, and scratch or build output is never committed. The rules are
// .claude/rules/structure.md; CLAUDE.md stays the one place where the layout is written down.
// docs/setup.md section 6, step 2.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

// Root files that structure.md allows but CLAUDE.md's File tree doesn't list.
const EXTRA_ROOT_FILES = [".gitignore", ".gitattributes", ".prettierignore", ".env.example"];

// structure.md: tool configs the stack needs at the root are named `*.config.*`.
const ROOT_CONFIG = /^[^/]+\.config\.[^/]+$/;

// structure.md "Never as a name or a whole name segment".
const BANNED_NAMES = new Set([
  "utils2",
  "helpers-new",
  "old",
  "backup",
  "copy",
  "final",
  "v2",
  "test123",
  "temp",
  "tmp",
  "misc",
  "stuff",
]);

// Working folders and build output that .gitignore keeps out; a file here got in by force.
const FORBIDDEN_FOLDERS = [".scratch", ".review", ".next", "graphify-out", "node_modules"];

/**
 * Reads the top-level names from the File tree in CLAUDE.md.
 * Depth-0 lines look like `├── src/`, `├── README.md, CLAUDE.md` or
 * `├── docs/         challenge, spec` (the name, then a description after two spaces).
 * Wrapped lines of a root list start with `│   ` and carry no tree branch.
 * @returns {{folders: Set<string>, files: Set<string>}}
 */
export function readRootNames(claudeMd) {
  const block = claudeMd.split("## File tree")[1]?.match(/```text\n([\s\S]*?)```/)?.[1] ?? "";
  const folders = new Set();
  const files = new Set();
  for (const line of block.split("\n")) {
    const entry = line.match(/^[├└]── (.*)$/)?.[1] ?? line.match(/^│ {3}([^├└│\s].*)$/)?.[1];
    if (entry === undefined) continue;
    for (const raw of entry.split(/ {2,}/)[0].split(",")) {
      const name = raw.trim();
      if (name === "") continue;
      if (name.endsWith("/")) folders.add(name.slice(0, -1));
      else files.add(name);
    }
  }
  return { folders, files };
}

/**
 * Checks tracked files against the structure rules.
 * @param {string[]} files repo-relative paths from `git ls-files`
 * @param {string} claudeMd the text of CLAUDE.md
 * @returns {string[]} one line per problem
 */
export function findTreeProblems(files, claudeMd) {
  const { folders, files: rootFiles } = readRootNames(claudeMd);
  const problems = [];
  const reportedFolders = new Set();
  for (const path of files) {
    const [first, ...rest] = path.split("/");
    if (FORBIDDEN_FOLDERS.includes(first)) {
      problems.push(`${path}: ${first}/ is a working or build folder and is never committed`);
    } else if (rest.length === 0 && !isAllowedRootFile(first, rootFiles)) {
      problems.push(`${path}: not an allowed root file; move it into a folder (structure.md)`);
    } else if (rest.length > 0 && !folders.has(first) && !reportedFolders.has(first)) {
      reportedFolders.add(first);
      problems.push(
        `${first}/: not a top-level folder in the CLAUDE.md File tree; add it there first`,
      );
    }
    const banned = bannedSegment(path);
    if (banned) problems.push(`${path}: "${banned}" is a banned name (structure.md, Names)`);
  }
  return problems;
}

function isAllowedRootFile(name, rootFiles) {
  return rootFiles.has(name) || EXTRA_ROOT_FILES.includes(name) || ROOT_CONFIG.test(name);
}

/**
 * The banned name a path uses, or undefined. A segment is a whole folder or file name
 * (extension dropped) or one dash, dot or underscore separated piece of it, so `old.ts` and
 * `utils2.ts` fail while `CopyButton.tsx` and `template.tsx` pass.
 * @example bannedSegment("src/lib/utils2.ts") // "utils2"
 */
export function bannedSegment(path) {
  for (const part of path.split("/")) {
    const stem = part.replace(/\.[^.]+$/, "").toLowerCase();
    const candidates = [part.toLowerCase(), stem, ...stem.split(/[-_.]+/)];
    const hit = candidates.find((candidate) => BANNED_NAMES.has(candidate));
    if (hit) return hit;
  }
  return undefined;
}

function main() {
  const tracked = execFileSync("git", ["ls-files", "-z"], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  })
    .split("\0")
    .filter((line) => line !== "");
  const problems = findTreeProblems(tracked, readFileSync("CLAUDE.md", "utf8"));
  for (const problem of problems) console.error(`::error::${problem}`);
  if (problems.length > 0) process.exit(1);
  console.log(`Tree is in order (${tracked.length} files).`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
