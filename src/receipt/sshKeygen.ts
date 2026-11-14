import { spawn } from "node:child_process";
import { CommandError } from "./context";

/**
 * The ssh-keygen the spec pins (OpenSSH 10.2) on Windows. Windows' inbox OpenSSH in
 * System32 often comes first on PATH and behaves differently, so the CLI and the
 * tests name Git for Windows' build; elsewhere the PATH one is used.
 */
export const defaultSshKeygenPath =
  process.platform === "win32" ? "C:/Program Files/Git/usr/bin/ssh-keygen.exe" : "ssh-keygen";

/** Forward slashes for every path handed to ssh-keygen: its msys build misreads backslashes. */
export function toSshPath(path: string): string {
  return path.replaceAll("\\", "/");
}

/** What an ssh-keygen run produced. */
export type SshKeygenResult = { code: number; stdout: string; stderr: string };

/**
 * Runs ssh-keygen without a shell. Stdin is closed unless `stdin` is given, so a
 * key that wants a passphrase fails at once instead of waiting on a prompt.
 * `useTerminal` hands ssh-keygen this process's terminal (stdin and stderr) so it
 * can prompt for a passphrase; stderr is then not captured.
 *
 * @throws CommandError (exit 1) when ssh-keygen is not installed.
 */
export function runSshKeygen(
  sshKeygenPath: string,
  args: string[],
  options: { stdin?: Buffer; cwd?: string; useTerminal?: boolean } = {},
): Promise<SshKeygenResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(sshKeygenPath, args, {
      cwd: options.cwd,
      stdio: options.useTerminal
        ? ["inherit", "pipe", "inherit"]
        : [options.stdin ? "pipe" : "ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout?.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr?.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", (error: NodeJS.ErrnoException) => {
      reject(
        error.code === "ENOENT"
          ? new CommandError(
              1,
              "ssh-keygen not found: install Git for Windows or OpenSSH, or put ssh-keygen on PATH.",
            )
          : error,
      );
    });
    child.on("close", (code) => {
      resolve({
        code: code ?? 1,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      });
    });
    // The payload is small; a verifier that exits early may close the pipe first.
    child.stdin?.on("error", () => {});
    if (options.stdin) child.stdin?.end(options.stdin);
  });
}
