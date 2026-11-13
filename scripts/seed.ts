/**
 * Seed: gets this machine ready to run the pipeline and the receipt CLI.
 * Both read Tieto's code from a local clone of our fork (SAMPLE_REPO_DIR), so
 * this clones it once, fetches every branch plus the receipt notes, and checks
 * that the branches the sample changes come from are there. Spec section 9.1, T07.
 *
 * Run with `pnpm seed`. Exit 0 on success, 1 on any failure.
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const FORK_URL =
  "https://github.com/miska-voutilainen/junction26-messagepack-csharp.git";

/** Tieto branches the four sample changes come from. T07 swaps this for the `headSha`s in data/sample/changes/*.json. */
export const TIETO_BRANCHES = [
  "ju26-issue-2283",
  "ju26-issue-2234",
  "ju26-issue-2129",
  "ju26-issue-2297",
] as const;

const NOTES_REF = "refs/notes/countersign";

/** Where the script reads its settings and writes its messages; tests pass their own. */
export interface SeedOptions {
  sampleRepoDir: string | undefined;
  forkUrl: string;
  log: (line: string) => void;
  error: (line: string) => void;
}

/** A failure the person can fix; `seed` prints the message and exits 1. */
class SeedError extends Error {}

/**
 * Runs every seed step in order.
 * @returns the process exit code: 0 when the clone is ready, 1 on any failure.
 */
export function seed(options: SeedOptions): number {
  try {
    const dir = requireSampleRepoDir(options.sampleRepoDir);
    cloneIfMissing(dir, options.forkUrl, options.log);
    checkOrigin(dir, options.forkUrl);
    fetchBranchesAndNotes(dir, options.log);
    printBranchHeads(dir, options.log);
    return 0;
  } catch (failure) {
    options.error(failure instanceof Error ? failure.message : String(failure));
    return 1;
  }
}

function requireSampleRepoDir(sampleRepoDir: string | undefined): string {
  if (!sampleRepoDir) {
    throw new SeedError(
      "SAMPLE_REPO_DIR is not set. Add it to .env as the absolute path where the fork should be cloned (see .env.example), then run pnpm seed again.",
    );
  }
  return sampleRepoDir;
}

function cloneIfMissing(
  dir: string,
  forkUrl: string,
  log: (line: string) => void,
): void {
  if (existsSync(dir)) return;
  log(`Cloning ${forkUrl} into ${dir}`);
  git(["clone", forkUrl, dir], process.cwd());
}

/**
 * Refuses a folder that is a clone of something else: receipts and reviews
 * would be written against the wrong history.
 * Example: origin `https://github.com/MessagePack-CSharp/MessagePack-CSharp.git` is rejected.
 */
export function checkOrigin(dir: string, forkUrl: string): void {
  const origin = git(
    ["config", "--get", "remote.origin.url"],
    dir,
    "SAMPLE_REPO_DIR is not a clone of the fork",
  );
  if (trimUrl(origin) !== trimUrl(forkUrl)) {
    throw new SeedError(
      `SAMPLE_REPO_DIR is not a clone of the fork: origin is ${origin}, expected ${forkUrl}. Point SAMPLE_REPO_DIR at an empty or missing folder, or at a clone of the fork.`,
    );
  }
}

function fetchBranchesAndNotes(dir: string, log: (line: string) => void): void {
  git(["fetch", "origin"], dir);
  // Fetching a ref that doesn't exist fails the whole command, so ask the remote first.
  const remoteHasNotes = git(["ls-remote", "origin", NOTES_REF], dir) !== "";
  if (!remoteHasNotes) {
    log("No receipts yet");
    return;
  }
  git(["fetch", "origin", `${NOTES_REF}:${NOTES_REF}`], dir);
  log("Fetched receipts");
}

function printBranchHeads(dir: string, log: (line: string) => void): void {
  const missing: string[] = [];
  for (const branch of TIETO_BRANCHES) {
    const headSha = tryGit(
      ["rev-parse", "--verify", `refs/remotes/origin/${branch}`],
      dir,
    );
    if (headSha === undefined) missing.push(branch);
    else log(`${branch} ${headSha}`);
  }
  if (missing.length > 0) {
    throw new SeedError(
      `Branches missing on origin: ${missing.join(", ")}. The fork must keep all of Tieto's branches; ask the engine lane to re-sync it.`,
    );
  }
}

function trimUrl(url: string): string {
  return url
    .trim()
    .replace(/\/+$/, "")
    .replace(/\.git$/, "");
}

function tryGit(args: string[], cwd: string): string | undefined {
  try {
    return execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return undefined;
  }
}

function git(args: string[], cwd: string, failureMessage?: string): string {
  try {
    return execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (failure) {
    const stderr =
      failure instanceof Error && "stderr" in failure
        ? String(failure.stderr).trim()
        : "";
    throw new SeedError(
      `${failureMessage ?? `git ${args[0]} failed`}${stderr ? `: ${stderr}` : ""}`,
    );
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (existsSync(".env")) process.loadEnvFile();
  process.exitCode = seed({
    sampleRepoDir: process.env.SAMPLE_REPO_DIR,
    forkUrl: FORK_URL,
    log: console.log,
    error: console.error,
  });
}
