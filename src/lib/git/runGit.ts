import { execFile } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Largest git output accepted: far above any sample diff; it only guards against a runaway process. */
const maxGitOutputBytes = 512 * 1024 * 1024;

/** Where an empty git config file lives, created once per process. */
let emptyConfigPath: Promise<string> | null = null;

function emptyGitConfig(): Promise<string> {
  emptyConfigPath ??= mkdtemp(join(tmpdir(), "countersign-gitconfig-")).then(async (dir) => {
    const path = join(dir, "empty.gitconfig");
    await writeFile(path, "");
    return path;
  });
  return emptyConfigPath;
}

/**
 * Runs git in `repoDir` without a shell and returns the raw stdout bytes.
 *
 * With `isolated`, system and global config are ignored, so the output cannot
 * depend on one machine's settings (autocrlf, diff drivers, colour).
 *
 * @throws Error with git's stderr and the command when git exits non-zero.
 */
export async function runGit(
  repoDir: string,
  args: string[],
  options: { isolated?: boolean } = {},
): Promise<Buffer> {
  const env = options.isolated
    ? { ...process.env, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: await emptyGitConfig() }
    : process.env;
  return new Promise((resolve, reject) => {
    execFile(
      "git",
      args,
      { cwd: repoDir, env, encoding: "buffer", maxBuffer: maxGitOutputBytes },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`git ${args.join(" ")} failed in ${repoDir}: ${stderr.toString().trim() || error.message}`));
          return;
        }
        resolve(stdout);
      },
    );
  });
}
