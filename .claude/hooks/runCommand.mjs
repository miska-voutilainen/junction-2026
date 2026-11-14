// Shared by the format and quality hooks: run a tool without a shell and say whether it really
// finished. A hook must never block the agent because a tool is missing (a fresh worktree has no
// node_modules), timed out or crashed; it blocks only when a tool ran to the end and reported problems.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Runs `file` with `args`, no shell, so a timeout kills the real process on Windows too.
 * @param {string} file executable
 * @param {string[]} args
 * @param {{ cwd: string, timeoutMs: number, input?: string, failureStatuses?: number[] }} options
 *   `failureStatuses`: exit codes that mean "the tool ran and found problems" (default `[1]`)
 * @returns {{ ran: boolean, ok: boolean, failed: boolean, output: string, stdout: string }}
 *   `ran` is false on a spawn error or timeout; `failed` is true only for a completed run with a failure status
 */
export function runCommand(file, args, { cwd, timeoutMs, input, failureStatuses = [1] }) {
  const result = spawnSync(file, args, {
    cwd,
    input,
    encoding: "utf8",
    timeout: timeoutMs,
    windowsHide: true,
  });
  const ran = !result.error && result.status !== null;
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
  return {
    ran,
    ok: ran && result.status === 0,
    failed: ran && failureStatuses.includes(result.status),
    output,
    stdout: result.stdout ?? "",
  };
}

/**
 * Runs a JavaScript tool from the project's own node_modules with the current Node.
 * @param {string} root project root holding node_modules
 * @param {string} script path of the tool's entry file inside node_modules, e.g. `eslint/bin/eslint.js`
 * @returns {{ ran: boolean, ok: boolean, failed: boolean, output: string }} `ran` is false when the tool is not installed
 */
export function runNodeTool(root, script, args, options) {
  const entry = join(root, "node_modules", script);
  if (!existsSync(entry))
    return {
      ran: false,
      ok: false,
      failed: false,
      output: `${script} is not installed in ${root}`,
      stdout: "",
    };
  return runCommand(process.execPath, [entry, ...args], { cwd: root, ...options });
}
