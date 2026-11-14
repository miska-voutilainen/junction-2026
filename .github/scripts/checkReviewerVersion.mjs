// Prompt freeze in CI: the planted-bug eval measured one reviewer, and a reviewer is its prompts and
// everything they import. A PR that changes one of those files without bumping `reviewerVersion`
// would leave the committed report card describing a reviewer that no longer exists, and
// `pnpm evals` would reuse the old runs (they carry the old version, so they count as current) and
// show no change. This check fails that PR and names the fix. Spec section 6, Planted-bug eval: any
// later prompt change makes a new reviewer version and the eval reruns.
//
// Env: BASE_SHA (origin/main when unset, for local runs). Needs full git history, like the other checks.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const PROMPT_DIR = "src/prompts/";
const VERSION_FILE = "src/pipeline/assembleReview.ts";

// The contract schemas shape every answer too, but a schema change already changes the recording
// key (src/ai/recordings.ts), so replay fails loudly, and it goes through the shared-path agreement.
// Counting the contracts barrel would make every contract edit a new reviewer.
const NOT_PROMPT_INPUTS = new Set(["src/contracts/index.ts"]);

// Matches the module of a relative import: `} from "../pipeline/promptContext";` gives
// "../pipeline/promptContext". Package imports ("zod") don't start with a dot and are skipped.
const RELATIVE_IMPORT = /from "(\.{1,2}\/[^"]+)"/g;

/**
 * The files outside src/prompts/ that the prompts import: their text, limits and validators reach
 * the model's input or decide which answers count, so changing one changes the reviewer.
 * Derived from the imports, not listed by hand, so a new import can't slip past the check.
 * @param {{ file: string, text: string }[]} promptSources every non-test file in src/prompts/
 * @param {(file: string) => boolean} exists whether a repository file exists
 * @returns {Set<string>} repository paths, e.g. "src/pipeline/promptContext.ts"
 */
export function promptInputs(promptSources, exists) {
  const inputs = new Set();
  for (const { file, text } of promptSources) {
    for (const match of text.matchAll(RELATIVE_IMPORT)) {
      const target = path.posix.join(path.posix.dirname(file), match[1]);
      const resolved = exists(`${target}.ts`) ? `${target}.ts` : `${target}/index.ts`;
      if (!resolved.startsWith(PROMPT_DIR) && !NOT_PROMPT_INPUTS.has(resolved))
        inputs.add(resolved);
    }
  }
  return inputs;
}

/**
 * Whether a changed file can alter what the model is asked or which answers count.
 * @example readsIntoPrompt("src/prompts/a3.ts", inputs) // true
 * @example readsIntoPrompt("src/prompts/a3.test.ts", inputs) // false
 */
export function readsIntoPrompt(file, inputs) {
  if (file.endsWith(".test.ts")) return false;
  return file.startsWith(PROMPT_DIR) || inputs.has(file);
}

/**
 * Names what is wrong, or returns null when the PR leaves the reviewer as it was or versions it.
 * Compares the version's value, so moving or reformatting the line is not a bump.
 * @param {string[]} promptFiles the changed files `readsIntoPrompt` accepts
 * @param {string | null} baseVersion reviewerVersion on the base branch
 * @param {string | null} headVersion reviewerVersion in this PR
 * @returns {string | null}
 */
export function findVersionProblem(promptFiles, baseVersion, headVersion) {
  if (promptFiles.length === 0 || baseVersion !== headVersion) return null;
  return (
    `${promptFiles.join(", ")} change what the model reads, but reviewerVersion is still ${headVersion}. ` +
    `Bump it in ${VERSION_FILE} and re-run pnpm evals, so the report card describes this reviewer.`
  );
}

/** The value of `export const reviewerVersion = "rv2";` in a file's text, or null without that line. */
export function reviewerVersionIn(text) {
  return /^export const reviewerVersion = "([^"]+)";/m.exec(text)?.[1] ?? null;
}

// git by absolute path, as in checkTree.mjs: a bare "git" is looked up on PATH, where a writable
// folder early on it could put another program in its place and run it with this script's rights.
const GIT_LOCATIONS = ["/usr/bin/git", "/usr/local/bin/git", "C:/Program Files/Git/cmd/git.exe"];

function git(...args) {
  const gitPath = GIT_LOCATIONS.find((location) => existsSync(location));
  if (gitPath === undefined)
    throw new Error(`git not found in ${GIT_LOCATIONS.join(", ")}. Install git.`);
  return execFileSync(gitPath, args, { encoding: "utf8" });
}

/** Every non-test file in src/prompts/ with its text, for `promptInputs`. */
export function readPromptSources() {
  return readdirSync(PROMPT_DIR)
    .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
    .map((name) => ({ file: PROMPT_DIR + name, text: readFileSync(PROMPT_DIR + name, "utf8") }));
}

function main() {
  const base = process.env.BASE_SHA || "origin/main";
  const inputs = promptInputs(readPromptSources(), existsSync);
  const changedFiles = git("diff", "--name-only", `${base}...HEAD`).split("\n").filter(Boolean);
  const promptFiles = changedFiles.filter((file) => readsIntoPrompt(file, inputs));
  const baseVersion = reviewerVersionIn(git("show", `${base}:${VERSION_FILE}`));
  const headVersion = reviewerVersionIn(readFileSync(VERSION_FILE, "utf8"));
  const problem = findVersionProblem(promptFiles, baseVersion, headVersion);
  if (problem) {
    console.error(`::error::${problem}`);
    process.exit(1);
  }
  console.log(`Reviewer version ${headVersion} is consistent with the prompt files.`);
}

// argv[1] is missing when the module is imported from `node -e`.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
