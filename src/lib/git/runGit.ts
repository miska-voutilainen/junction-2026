import { execFile } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Largest git output accepted: far above any sample diff; it only guards against a runaway process. */
const maxGitOutputBytes = 512 * 1024 * 1024;

/**
 * Where an empty git config file lives, created once per process. It is a real
 * file because Git for Windows has no /dev/null path to point GIT_CONFIG_GLOBAL at.
 */
let emptyConfigPath: Promise<string> | null = null;

function emptyGitConfig(): Promise<string> {
  emptyConfigPath ??= mkdtemp(join(tmpdir(), "countersign-gitconfig-")).then(async (dir) => {
    const path = join(dir, "empty.gitconfig");
    await writeFile(path, "");
    return path;
  });
  return emptyConfigPath;
}

/** Variables that change what git reads or how it diffs, besides the config files. */
const gitOverrideNames = [
  "GIT_CONFIG_PARAMETERS", "GIT_CONFIG_COUNT", "GIT_DIFF_OPTS", "GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_EXTERNAL_DIFF",
];

async function isolatedEnv(): Promise<NodeJS.ProcessEnv> {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const name of Object.keys(env)) {
    if (gitOverrideNames.includes(name) || /^GIT_CONFIG_(KEY|VALUE)_\d+$/.test(name)) delete env[name];
  }
  // LC_ALL=C keeps git's messages and ordering the same on every machine.
  return { ...env, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: await emptyGitConfig(), LC_ALL: "C" };
}

/**
 * Runs git in `repoDir` without a shell and returns the raw stdout bytes.
 *
 * With `isolated`, system and global config and git's environment overrides
 * are ignored, so the output cannot depend on one machine's settings (diff
 * drivers, colour, prefixes).
 *
 * @throws Error with git's stderr and the command when git exits non-zero.
 */
export async function runGit(
  repoDir: string,
  args: string[],
  options: { isolated?: boolean } = {},
): Promise<Buffer> {
  const env = options.isolated ? await isolatedEnv() : process.env;
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
