/**
 * Diff identity: the fingerprint a signed receipt binds to. A receipt that
 * said "approved" about a diff nobody can pin down would prove nothing, so the
 * hash covers the exact bytes git produces for base..head, with every setting
 * that could change them (config, rename detection, prefixes) fixed. The review
 * and the receipt call this one function; if the diff changes, the hash changes
 * and the receipt reads as stale. Spec section 5, Diff identity.
 */
import { createHash } from "node:crypto";
import { runGit } from "./runGit";

/** The identity of a diff between two commits. */
export interface DiffIdentity {
  baseTree: string;
  headTree: string;
  /** Hex sha256 of git's raw diff output. */
  diffSha256: string;
}

/** The fixed git arguments of the hashed diff; changing any of them changes every receipt's hash. */
function identityDiffArgs(baseSha: string, headSha: string): string[] {
  return [
    "-c", "core.quotepath=false",
    "-c", "diff.algorithm=myers",
    "diff", "--binary", "--no-ext-diff", "--no-color", "--no-renames", "--full-index",
    "--src-prefix=a/", "--dst-prefix=b/",
    baseSha, headSha,
  ];
}

/**
 * Computes the tree SHAs of both commits and the sha256 of their diff.
 *
 * @param repoDir absolute path of the clone (SAMPLE_REPO_DIR)
 * @throws Error naming the failed git command, e.g. when a SHA isn't in the clone (run pnpm seed).
 */
export async function computeDiffIdentity(
  repoDir: string,
  baseSha: string,
  headSha: string,
): Promise<DiffIdentity> {
  const [baseTree, headTree, rawDiff] = await Promise.all([
    readTreeSha(repoDir, baseSha),
    readTreeSha(repoDir, headSha),
    runGit(repoDir, identityDiffArgs(baseSha, headSha), { isolated: true }),
  ]);
  return { baseTree, headTree, diffSha256: createHash("sha256").update(rawDiff).digest("hex") };
}

async function readTreeSha(repoDir: string, commitSha: string): Promise<string> {
  const output = await runGit(repoDir, ["rev-parse", `${commitSha}^{tree}`], { isolated: true });
  return output.toString().trim();
}
