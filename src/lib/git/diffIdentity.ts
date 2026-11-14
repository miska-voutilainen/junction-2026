/**
 * Diff identity: the fingerprint a signed receipt binds to. A receipt that
 * said "approved" about a diff nobody can pin down would prove nothing, so the
 * hash covers the exact bytes git produces for base..head. What is pinned:
 * system and global git config are ignored, git's environment overrides are
 * removed, and the diff options are fixed (algorithm, no external diff, no
 * renames, prefixes, quoting, binary and full-index output). What is not: the
 * clone's own `.git/config` is still read (`pnpm seed` sets only
 * `core.longpaths`, which does not change diff output), and the hashed diff
 * passes no `-U`, `--no-textconv` or indent-heuristic flag. A clone whose own
 * config sets `diff.context`, `diff.indentHeuristic` or a textconv driver
 * would hash the same change differently, and `verify` would call a good
 * receipt stale.
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
  return [
    "-c", "core.quotepath=false",
    "-c", "diff.algorithm=myers",
    "diff", ...extraOptions, "--no-ext-diff", "--no-color", "--no-renames",
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
    runGit(repoDir, pinnedDiffArgs(baseSha, headSha, ["--binary", "--full-index"]), { isolated: true }),
  ]);
  return { baseTree, headTree, diffSha256: createHash("sha256").update(rawDiff).digest("hex") };
}

async function readTreeSha(repoDir: string, commitSha: string): Promise<string> {
  const output = await runGit(repoDir, ["rev-parse", `${commitSha}^{tree}`], { isolated: true });
  return output.toString().trim();
}
