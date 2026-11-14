import { runGit } from "./runGit";

/**
 * Reads a file as it is at a commit, without touching the working tree. A5 and
 * the quote check read the base and head versions this way.
 *
 * @param path repo-relative, forward slashes
 * @returns the file text, or null when there is no file at that path at that commit
 *   (added by the change, deleted by it, or the path is a folder)
 * @throws Error when the commit is unknown.
 */
export async function readFileAtCommit(repoDir: string, sha: string, path: string): Promise<string | null> {
  // Fails on an unknown commit, so an empty listing below can only mean a missing path.
  await runGit(repoDir, ["cat-file", "-e", `${sha}^{commit}`], { isolated: true });
  const entry = (await runGit(repoDir, ["ls-tree", sha, "--", path], { isolated: true })).toString().trim();
  if (entry === "") return null;
  // Each entry is "<mode> <type> <sha>", a tab, then the path. A folder or submodule is not a blob, so there is no text.
  if (entry.split(/\s/)[1] !== "blob") return null;
  const content = await runGit(repoDir, ["cat-file", "blob", `${sha}:${path}`], { isolated: true });
  return content.toString("utf8");
}
