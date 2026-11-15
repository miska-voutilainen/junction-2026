/**
 * Diff identity: the fingerprint a signed receipt binds to. A receipt that
 * said "approved" about a diff nobody can pin down would prove nothing, so the
 * hash covers the exact bytes git produces for base..head. What is pinned:
 * system and global git config are ignored, git's environment overrides are
 * removed, and every diff option that git would otherwise take from the
 * clone's own `.git/config` or from a `.gitattributes` textconv driver is set
 * on the command line (algorithm, context, hunk merging, indent heuristic,
 * textconv, relative paths, submodule format, renames, prefixes,
 * quoting, binary and full-index output). So a clone that sets
 * `diff.context` or `diff.indentHeuristic` hashes the same change the same way.
 * Not pinned: `diff.orderFile` (git rejects an empty value), which only reorders files.
 * The review and the receipt call this one function; if the diff changes, the
 * hash changes and the receipt reads as stale. Spec section 5, Diff identity.
 */
import { createHash } from "node:crypto";
import { ShaSchema } from "../../contracts";
import { runGit } from "./runGit";

/** The identity of a diff between two commits. */
export interface DiffIdentity {
  /** Tree SHA of the base commit; binds the content the change started from, not the history that led to it. */
  baseTree: string;
  /** Tree SHA of the head commit; binds the content that was reviewed, not the history that led to it. */
  headTree: string;
  /** Hex sha256 of git's raw diff output. */
  diffSha256: string;
}

/**
 * The pinned `git diff` arguments shared by the hashed diff and the hunk diff,
 * so the hunks the reviewer sees come from the same options as the hash.
 * `extraOptions` adds what only one of them needs (--binary, -U3).
 */
export function pinnedDiffArgs(baseSha: string, headSha: string, extraOptions: string[]): string[] {
  // prettier-ignore
  return [
    "-c", "core.quotepath=false",
    "-c", "diff.algorithm=myers",
    // Blank-line suppression would change the bytes of context lines.
    "-c", "diff.suppressBlankEmpty=false",
    // The pins come before `extraOptions`, so a caller's own -U (the hunk diff) wins.
    "diff", "-U3", "--inter-hunk-context=0", "--no-textconv", "--indent-heuristic",
    "--no-relative", "--submodule=short", ...extraOptions,
    "--no-ext-diff", "--no-color", "--no-renames",
    "--src-prefix=a/", "--dst-prefix=b/",
    baseSha, headSha,
  ];
}

/**
 * Computes the tree SHAs of both commits and the sha256 of their diff.
 *
 * @param repoDir absolute path of the clone (SAMPLE_REPO_DIR)
 * @throws Error when a SHA is not 40 hex characters, or naming the failed git
 *   command, e.g. when a SHA isn't in the clone (run pnpm seed).
 */
export async function computeDiffIdentity(
  repoDir: string,
  baseSha: string,
  headSha: string,
): Promise<DiffIdentity> {
  // A value starting with "-" would reach git as an option.
  ShaSchema.parse(baseSha);
  ShaSchema.parse(headSha);
  const [baseTree, headTree, rawDiff] = await Promise.all([
    readTreeSha(repoDir, baseSha),
    readTreeSha(repoDir, headSha),
    runGit(repoDir, pinnedDiffArgs(baseSha, headSha, ["--binary", "--full-index"]), {
      isolated: true,
    }),
  ]);
  return { baseTree, headTree, diffSha256: createHash("sha256").update(rawDiff).digest("hex") };
}

async function readTreeSha(repoDir: string, commitSha: string): Promise<string> {
  const output = await runGit(repoDir, ["rev-parse", `${commitSha}^{tree}`], { isolated: true });
  return output.toString().trim();
}
