import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { seed, type SampleChange } from "./seed";

let workDir: string;
let forkDir: string;
let logged: string[];
let errors: string[];
let changes: SampleChange[];

const BRANCHES = [
  "ju26-issue-2283",
  "ju26-issue-2234",
  "ju26-issue-2129",
  "ju26-issue-2297",
];

function git(cwd: string, ...args: string[]): string {
  return execFileSync(
    "git",
    ["-c", "user.name=Test", "-c", "user.email=test@example.com", ...args],
    {
      cwd,
      encoding: "utf8",
    },
  ).trim();
}

/** A local repo standing in for the fork, with one branch per sample change; no network. */
function makeFork(): void {
  mkdirSync(forkDir);
  git(forkDir, "init", "-q", "-b", "main");
  git(forkDir, "commit", "-q", "--allow-empty", "-m", "base");
  changes = BRANCHES.map((branch) => {
    git(forkDir, "checkout", "-q", "-b", branch, "main");
    git(forkDir, "commit", "-q", "--allow-empty", "-m", branch);
    return { id: branch, headSha: git(forkDir, "rev-parse", "HEAD") };
  });
  git(forkDir, "checkout", "-q", "main");
}

function run(sampleRepoDir: string | undefined): number {
  return seed({
    sampleRepoDir,
    forkUrl: forkDir,
    changes,
    log: (line) => logged.push(line),
    error: (line) => errors.push(line),
  });
}

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), "seed-test-"));
  forkDir = join(workDir, "fork");
  logged = [];
  errors = [];
  changes = [];
});

afterEach(() => rmSync(workDir, { recursive: true, force: true }));

describe("seed", () => {
  it("exits 1 and says how to fix it when SAMPLE_REPO_DIR is not set", () => {
    expect(run(undefined)).toBe(1);
    expect(errors[0]).toContain("SAMPLE_REPO_DIR is not set");
  });

  it("clones a missing folder, prints each change head and reports no receipts yet", () => {
    makeFork();
    const clone = join(workDir, "clone");

    expect(run(clone)).toBe(0);

    for (const change of changes) {
      expect(logged).toContain(`${change.id} ${change.headSha}`);
    }
    expect(logged).toContain("No receipts yet");
    expect(errors).toEqual([]);
  });

  it("fetches the receipt notes when the fork has them", () => {
    makeFork();
    git(forkDir, "notes", "--ref=countersign", "add", "-m", "receipt", "HEAD");
    const clone = join(workDir, "clone");

    expect(run(clone)).toBe(0);

    expect(git(clone, "notes", "--ref=countersign", "show", "main")).toBe(
      "receipt",
    );
    expect(logged).not.toContain("No receipts yet");
  });

  it("clones into an existing empty folder", () => {
    makeFork();
    const clone = join(workDir, "clone");
    mkdirSync(clone);

    expect(run(clone)).toBe(0);
  });

  it("exits 1 for a folder with content that is not a git repository", () => {
    makeFork();
    const notARepo = join(workDir, "notes");
    mkdirSync(notARepo);
    writeFileSync(join(notARepo, "todo.txt"), "not a clone");

    expect(run(notARepo)).toBe(1);
    expect(errors[0]).toContain("SAMPLE_REPO_DIR is not a clone of the fork");
  });

  it("exits 1 when the folder is a clone of another repository", () => {
    makeFork();
    const other = join(workDir, "other");
    mkdirSync(other);
    git(other, "init", "-q");
    git(
      other,
      "remote",
      "add",
      "origin",
      "https://github.com/MessagePack-CSharp/MessagePack-CSharp.git",
    );

    expect(run(other)).toBe(1);
    expect(errors[0]).toContain("SAMPLE_REPO_DIR is not a clone of the fork");
  });

  it("exits 1 and names the changes whose head commit is missing", () => {
    makeFork();
    const missing = { id: "mp-9999", headSha: "0".repeat(40) };
    changes.push(missing);

    expect(run(join(workDir, "clone"))).toBe(1);
    expect(errors[0]).toContain(`mp-9999 (${missing.headSha})`);
  });
});
