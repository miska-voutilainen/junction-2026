// Shared by the format and quality hooks: run a package-script command and capture its output.
import { spawnSync } from "node:child_process";

/**
 * Runs `command` in a shell (Node 24 on Windows runs `pnpm.cmd` only with `shell: true`) and
 * returns its exit status and combined stdout and stderr.
 * @param {string} command full command line; every argument must already be safe to pass through a shell
 * @param {{ cwd: string, timeoutMs: number }} options
 * @returns {{ ok: boolean, output: string }}
 */
export function runCommand(command, { cwd, timeoutMs }) {
  const result = spawnSync(command, { cwd, shell: true, encoding: "utf8", timeout: timeoutMs });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
  return { ok: result.status === 0 && !result.error, output };
}

/** Quotes a path for the shell so spaces survive; hook inputs never contain a double quote. */
export function quotePath(path) {
  return `"${path}"`;
}
