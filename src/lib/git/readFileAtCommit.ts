import { runGit } from "./runGit";

/**
 * Reads a file as it is at a commit with `git show`, without touching the
 * working tree. A5 and the quote check read the base and head versions this way.
 *
 * @param path repo-relative, forward slashes
 * @returns the file text, or null when the file doesn't exist at that commit
 *   (added by the change, or deleted by it)
 * @throws Error for any other git failure, such as an unknown SHA.
 */
export async function readFileAtCommit(repoDir: string, sha: string, path: string): Promise<string | null> {
  try {
    const content = await runGit(repoDir, ["show", `${sha}:${path}`], { isolated: true });
    return content.toString("utf8");
  } catch (error) {
    if (!isMissingPathError(error)) throw error;
    // git words an unknown commit the same way when the file exists on disk, so
    // confirm the commit is real before reading "missing" as "not in this commit".
    await runGit(repoDir, ["cat-file", "-e", `${sha}^{commit}`], { isolated: true });
    return null;
  }
}

// git words it "path 'x' does not exist in <sha>" or "exists on disk, but not in <sha>".
function isMissingPathError(error: unknown): boolean {
  return error instanceof Error && /does not exist in|exists on disk, but not in/.test(error.message);
}
