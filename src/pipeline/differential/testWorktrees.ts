import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runGit } from "../../lib/git/runGit";

/** The two checkouts the tests run in. */
export interface TestWorktrees {
  baseDir: string;
  headDir: string;
}

/**
 * Checks out the base and the head of the change in two worktrees under the OS
 * temp folder, runs `withWorktrees`, and removes both afterwards, also when it throws.
 * Worktrees keep the sample repository's own working folder untouched, and a
 * model-written test file can only ever land in a folder that is deleted again.
 *
 * @throws Error when git cannot add a worktree (unknown sha, no space).
 */
export async function withTestWorktrees<T>(
  repoDir: string,
  change: { baseSha: string; headSha: string },
  withWorktrees: (worktrees: TestWorktrees) => Promise<T>,
): Promise<T> {
  // A short root keeps the checkout under Windows' 260-character path limit.
  const root = await mkdtemp(join(tmpdir(), "cs-a5-"));
  const worktrees = { baseDir: join(root, "base"), headDir: join(root, "head") };
  try {
    await runGit(repoDir, ["worktree", "add", "--detach", worktrees.baseDir, change.baseSha]);
    await runGit(repoDir, ["worktree", "add", "--detach", worktrees.headDir, change.headSha]);
    return await withWorktrees(worktrees);
  } finally {
    await removeWorktrees(repoDir, root, Object.values(worktrees));
  }
}

async function removeWorktrees(repoDir: string, root: string, dirs: string[]): Promise<void> {
  for (const dir of dirs) {
    // One at a time: git locks the repository's worktree list while it removes one.
    // Fails when the worktree was never added; the folder is deleted below either way.
    await runGit(repoDir, ["worktree", "remove", "--force", dir]).catch(() => undefined);
  }
  // A leftover temp folder must not hide the result of the run, so a failure here is logged, not thrown.
  await rm(root, { recursive: true, force: true, maxRetries: 3 }).catch((error: unknown) =>
    console.error(`A5: could not remove ${root}: ${String(error)}`),
  );
  await runGit(repoDir, ["worktree", "prune"]).catch(() => undefined);
}
