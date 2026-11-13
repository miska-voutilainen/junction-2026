import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { seed, TIETO_BRANCHES } from "./seed";

let workDir: string;
let forkDir: string;
let logged: string[];
let errors: string[];

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

/** A local repo standing in for the fork, with the given branches; no network. */
function makeFork(branches: readonly string[]): void {
  mkdirSync(forkDir);
  git(forkDir, "init", "-q", "-b", "main");
  git(forkDir, "commit", "-q", "--allow-empty", "-m", "base");
  for (const branch of branches) git(forkDir, "branch", branch);
}

function run(sampleRepoDir: string | undefined): number {
  return seed({
    sampleRepoDir,
    forkUrl: forkDir,
    log: (line) => logged.push(line),
    error: (line) => errors.push(line),
  });
}

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), "seed-test-"));
  forkDir = join(workDir, "fork");
  logged = [];
  errors = [];
});

afterEach(() => rmSync(workDir, { recursive: true, force: true }));

describe("seed", () => {
  it("exits 1 and says how to fix it when SAMPLE_REPO_DIR is not set", () => {
    expect(run(undefined)).toBe(1);
    expect(errors[0]).toContain("SAMPLE_REPO_DIR is not set");
  });

  it("clones a missing folder, prints each branch head and reports no receipts yet", () => {
    makeFork(TIETO_BRANCHES);
    const clone = join(workDir, "clone");

    expect(run(clone)).toBe(0);

    const expectedHead = git(forkDir, "rev-parse", TIETO_BRANCHES[0]);
    expect(logged).toContain(`${TIETO_BRANCHES[0]} ${expectedHead}`);
    expect(logged).toContain("No receipts yet");
    expect(errors).toEqual([]);
  });

  it("fetches the receipt notes when the fork has them", () => {
    makeFork(TIETO_BRANCHES);
    git(forkDir, "notes", "--ref=countersign", "add", "-m", "receipt", "HEAD");
    const clone = join(workDir, "clone");

    expect(run(clone)).toBe(0);

    expect(git(clone, "notes", "--ref=countersign", "show", "main")).toBe(
      "receipt",
    );
    expect(logged).not.toContain("No receipts yet");
  });

  it("exits 1 when the folder is a clone of another repository", () => {
    makeFork(TIETO_BRANCHES);
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

  it("exits 1 and names the branches missing on origin", () => {
    makeFork(TIETO_BRANCHES.slice(0, 3));

    expect(run(join(workDir, "clone"))).toBe(1);
    expect(errors[0]).toContain(TIETO_BRANCHES[3]);
  });
});
