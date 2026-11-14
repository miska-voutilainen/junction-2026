/**
 * Seed: gets this machine ready to run the pipeline and the receipt CLI.
 * Both read Tieto's code from a local clone of our fork (SAMPLE_REPO_DIR), so
 * this clones it once, fetches every branch plus the receipt notes, and checks
 * that the head commit of every sample change is there. Spec section 9.1, T07.
 *
 * Run with `pnpm seed`. Exit 0 on success, 1 on any failure.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { ChangeInputSchema } from "../src/contracts";

const FORK_URL =
  "https://github.com/miska-voutilainen/junction26-messagepack-csharp.git";

const NOTES_REF = "refs/notes/countersign";

/** The part of a change input the seed needs: which commit to look for. */
export interface SampleChange {
  id: string;
  headSha: string;
}

/** Where the script reads its settings and writes its messages; tests pass their own. */
export interface SeedOptions {
  sampleRepoDir: string | undefined;
  forkUrl: string;
  /** The sample changes whose head commits must exist in the clone. */
  changes: SampleChange[];
  log: (line: string) => void;
  error: (line: string) => void;
}

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
    checkChangeHeads(dir, options.changes, options.log);
    return 0;
  } catch (failure) {
    options.error(failure instanceof Error ? failure.message : String(failure));
    return 1;
  }
}

function requireSampleRepoDir(sampleRepoDir: string | undefined): string {
  if (!sampleRepoDir) {
    throw new Error(
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
  // `git clone` accepts an empty folder, so only a folder with content is left alone.
  if (existsSync(dir) && readdirSync(dir).length > 0) return;
  log(`Cloning ${forkUrl} into ${dir}`);
  // Windows refuses the long snapshot file names in the fork unless long paths are on.
  git(
    ["-c", "core.longpaths=true", "clone", forkUrl, dir],
    process.cwd(),
    `Could not clone the fork. Check your network and your access to ${forkUrl}, then run pnpm seed again`,
  );
}

/**
 * Refuses a folder that is a clone of something else: receipts and reviews
 * would be written against the wrong history.
 * Example: origin `https://github.com/MessagePack-CSharp/MessagePack-CSharp.git` is rejected.
 */
function checkOrigin(dir: string, forkUrl: string): void {
  // Without its own .git, git would read the origin of a parent repository (this project's, for example).
  if (!existsSync(join(dir, ".git"))) {
    throw new Error(
      `SAMPLE_REPO_DIR is not a clone of the fork: ${dir} has content but no .git folder. Point SAMPLE_REPO_DIR at an empty or missing folder, or at a clone of the fork.`,
    );
  }
  const origin = git(
    ["config", "--get", "remote.origin.url"],
    dir,
    "SAMPLE_REPO_DIR is not a clone of the fork",
  );
  if (trimUrl(origin) !== trimUrl(forkUrl)) {
    throw new Error(
      `SAMPLE_REPO_DIR is not a clone of the fork: origin is ${origin}, expected ${forkUrl}. Point SAMPLE_REPO_DIR at an empty or missing folder, or at a clone of the fork.`,
    );
  }
}

function fetchBranchesAndNotes(dir: string, log: (line: string) => void): void {
  git(["fetch", "origin"], dir);
  // No `+` on the notes refspec: a local notes ref that has diverged holds receipts not yet pushed, and forcing would drop them.
  // Fetching a ref that doesn't exist fails the whole command, so ask the remote first.
  const remoteHasNotes = git(["ls-remote", "origin", NOTES_REF], dir) !== "";
  if (!remoteHasNotes) {
    log("No receipts yet");
    return;
  }
  git(["fetch", "origin", `${NOTES_REF}:${NOTES_REF}`], dir);
  log("Fetched receipts");
}

/**
 * Checks that each change's head commit is in the clone, so a force-pushed or
 * missing branch is caught here and not as a confusing diff error later.
 * Example line: `mp-2283 9df83c38409c8bfad0517aebffe48211eda4a5b4`.
 */
function checkChangeHeads(
  dir: string,
  changes: SampleChange[],
  log: (line: string) => void,
): void {
  const missing: string[] = [];
  for (const change of changes) {
    try {
      git(["cat-file", "-e", `${change.headSha}^{commit}`], dir);
      log(`${change.id} ${change.headSha}`);
    } catch {
      missing.push(`${change.id} (${change.headSha})`);
    }
  }
  if (missing.length > 0) {
    throw new Error(
      `Commits missing in the clone: ${missing.join(", ")}. The fork must keep all of Tieto's branches at the recorded heads; ask the engine lane to re-sync it.`,
    );
  }
}

/** Reads every data/sample/changes/*.json, validated, in file-name order. */
function loadSampleChanges(): SampleChange[] {
  const changesDir = "data/sample/changes";
  return readdirSync(changesDir)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) =>
      ChangeInputSchema.parse(
        JSON.parse(readFileSync(join(changesDir, file), "utf8")),
      ),
    );
}

function trimUrl(url: string): string {
  return url
    .trim()
    .replace(/\/+$/, "")
    .replace(/\.git$/, "");
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
    throw new Error(
      `${failureMessage ?? `git ${args[0]} failed`}${stderr ? `: ${stderr}` : ""}`,
    );
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (existsSync(".env")) process.loadEnvFile();
  process.exitCode = seed({
    sampleRepoDir: process.env.SAMPLE_REPO_DIR,
    forkUrl: FORK_URL,
    changes: loadSampleChanges(),
    log: (line) => process.stdout.write(`${line}\n`),
    error: (line) => process.stderr.write(`${line}\n`),
  });
}
