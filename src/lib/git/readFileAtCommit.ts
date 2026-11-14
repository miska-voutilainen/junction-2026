import { runGit } from "./runGit";

/**
 * Reads a file as it is at a commit, without touching the working tree. A5 and
 * the quote check read the base and head versions this way.
 *
 * @param path repo-relative, forward slashes
 * @returns the file text, or null when the file doesn't exist at that commit
 *   (added by the change, or deleted by it)
 * @throws Error when the commit is unknown or the path is a folder, not a file.
 */
export async function readFileAtCommit(repoDir: string, sha: string, path: string): Promise<string | null> {
  // Fails on an unknown commit, so an empty listing below can only mean a missing path.
  await runGit(repoDir, ["cat-file", "-e", `${sha}^{commit}`], { isolated: true });
  const entry = (await runGit(repoDir, ["ls-tree", sha, "--", path], { isolated: true })).toString().trim();
  if (entry === "") return null;
  // "<mode> <type> <sha>\t<path>": a folder is listed as a tree.
  const objectType = entry.split(/\s/)[1];
  if (objectType !== "blob") {
    throw new Error(`${path} at ${sha} is a ${objectType}, not a file. Pass the path of a file.`);
  }
  const content = await runGit(repoDir, ["cat-file", "blob", `${sha}:${path}`], { isolated: true });
  return content.toString("utf8");
}
