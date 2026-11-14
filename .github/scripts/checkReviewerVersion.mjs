// Prompt freeze in CI: the planted-bug eval measured one reviewer, and a reviewer is its prompts. A PR
// that changes a file the model reads without bumping `reviewerVersion` would leave the committed
// report card describing a reviewer that no longer exists, and `pnpm evals` would reuse the old runs
// (they carry the old version, so they count as current) and show no change. This check fails that PR
// and names the fix. Spec section 6, Planted-bug eval: any later prompt change makes a new reviewer
// version and the eval reruns.
//
// Env: BASE_SHA (origin/main when unset, for local runs). Needs full git history, like the other checks.
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const VERSION_FILE = "src/pipeline/assembleReview.ts";

/** Files besides src/prompts/ whose text reaches a prompt: A3's checklists and the refusal rules it is shown. */
const POLICY_FILES_IN_PROMPTS = ["src/policy/areaChecklists.ts", "src/policy/refusals.ts"];

/**
 * Whether a changed file can alter what the model is asked.
 * @example readsIntoPrompt("src/prompts/a3.ts") // true
 * @example readsIntoPrompt("src/prompts/a3.test.ts") // false
 */
export function readsIntoPrompt(file) {
  if (file.endsWith(".test.ts")) return false;
  return file.startsWith("src/prompts/") || POLICY_FILES_IN_PROMPTS.includes(file);
}

/**
 * Names what is wrong, or returns null when the PR leaves the reviewer as it was or versions it.
 * @param {string[]} changedFiles every file the PR changes
 * @param {string} versionFileDiff the PR's unified diff of src/pipeline/assembleReview.ts (-U0)
 * @returns {string | null}
 */
export function findVersionProblem(changedFiles, versionFileDiff) {
  const promptFiles = changedFiles.filter(readsIntoPrompt);
  if (promptFiles.length === 0) return null;
  if (/^\+export const reviewerVersion\b/m.test(versionFileDiff)) return null;
  return (
    `${promptFiles.join(", ")} change what the model reads, but reviewerVersion is unchanged. ` +
    `Bump it in ${VERSION_FILE} (rv1 to rv2) and re-run pnpm evals, so the report card describes this reviewer.`
  );
}

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" });
}

function main() {
  const base = process.env.BASE_SHA || "origin/main";
  const changedFiles = git("diff", "--name-only", `${base}...HEAD`).split("\n").filter(Boolean);
  const versionFileDiff = git("diff", "-U0", `${base}...HEAD`, "--", VERSION_FILE);
  const problem = findVersionProblem(changedFiles, versionFileDiff);
  if (problem) {
    console.error(`::error::${problem}`);
    process.exit(1);
  }
  console.log("Reviewer version is consistent with the prompt files.");
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
