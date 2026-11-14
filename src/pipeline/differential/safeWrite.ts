/**
 * Writing model-written files safely: A5's C# is untrusted, so every path it
 * names is resolved against the worktree and the test project before a byte is
 * written, and a path that leads out (a `..`, an absolute path, a symlink inside
 * the checkout) fails with nothing written. Spec section 6, A5.
 */
import { mkdir, realpath, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

/**
 * Joins a repository-relative path onto a worktree and refuses a result outside
 * it. The A5 schema already rejects `..`; this stays as the last check before
 * model-written content is written to disk.
 *
 * @throws Error when the path leaves the worktree.
 */
export function pathInside(worktreeDir: string, repoPath: string): string {
  const full = resolve(join(worktreeDir, repoPath));
  const outside = relative(worktreeDir, full);
  if (outside.startsWith("..") || isAbsolute(outside))
    throw new Error(`Test file path "${repoPath}" leaves the worktree. Nothing was written.`);
  return full;
}

/**
 * Writes model-written code into the test project, after resolving symlinks: a
 * link inside the checkout must not lead the write out of the project folder.
 *
 * @throws Error when the real folder is outside the project.
 */
export async function writeGeneratedFile(
  worktreeDir: string,
  projectDir: string,
  repoPath: string,
  text: string,
): Promise<void> {
  const path = pathInside(worktreeDir, repoPath);
  await mkdir(dirname(path), { recursive: true });
  const projectRoot = await realpath(join(worktreeDir, projectDir));
  const outside = relative(projectRoot, await realpath(dirname(path)));
  if (outside.startsWith("..") || isAbsolute(outside))
    throw new Error(`Test file path "${repoPath}" leaves the test project. Nothing was written.`);
  await writeFile(path, text, "utf8");
}

/** Writes the PR's own test file, already checked by `pathInside`, creating its folders. */
export async function writeNewFile(path: string, text: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, text, "utf8");
}
