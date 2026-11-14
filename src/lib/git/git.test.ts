/**
 * Tests against the real fork clone. They need SAMPLE_REPO_DIR (the absolute
 * path of the clone) and skip, with the reason printed, when it is unset: CI
 * has no clone.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ChangeInputSchema } from "../../contracts";
import { computeDiffIdentity } from "./diffIdentity";
import { loadDiff } from "./loadDiff";
import { readFileAtCommit } from "./readFileAtCommit";

function writeTempConfig(content: string): string {
  const path = join(mkdtempSync(join(tmpdir(), "countersign-test-")), "gitconfig");
  writeFileSync(path, content);
  return path;
}

const repoDir = process.env.SAMPLE_REPO_DIR;
const describeWithClone = repoDir ? describe : describe.skip;
if (!repoDir) console.info("git.test.ts skipped: SAMPLE_REPO_DIR is not set (absolute path of the fork clone).");

const change = ChangeInputSchema.parse(
  JSON.parse(readFileSync(join(__dirname, "../../../data/sample/changes/mp-2283.json"), "utf8")),
);
const { baseSha, headSha } = change;

describeWithClone("against the fork clone, mp-2283", () => {
  it("loads hunks whose ids, lines and file links agree with each other", async () => {
    const { diff, files, hunks } = await loadDiff(repoDir!, baseSha, headSha);
    expect(hunks.map((hunk) => hunk.id)).toEqual(hunks.map((_, index) => `h${index + 1}`));
    expect(files.flatMap((file) => file.hunkIds)).toEqual(hunks.map((hunk) => hunk.id));
    expect(diff.filesChanged).toBe(files.length);
    // git's own numstat is the oracle for the added and removed line counts.
    const numstat = execFileSync("git", ["diff", "--no-renames", "--numstat", baseSha, headSha], { cwd: repoDir, encoding: "utf8" })
      .trim().split("\n").map((row) => row.split("\t"));
    // numstat prints "-" for a binary file, which has no counted lines.
    const count = (value: string | undefined) => (value === "-" ? 0 : Number(value));
    expect(diff.linesAdded).toBe(numstat.reduce((sum, [added]) => sum + count(added), 0));
    expect(diff.linesRemoved).toBe(numstat.reduce((sum, [, removed]) => sum + count(removed), 0));
    for (const hunk of hunks) {
      expect(hunk.lines.filter((line) => line.kind !== "add")).toHaveLength(hunk.oldLines);
      expect(hunk.lines.filter((line) => line.kind !== "del")).toHaveLength(hunk.newLines);
    }
  });

  it("computes the same identity twice, and a different one for an empty diff", async () => {
    const first = await computeDiffIdentity(repoDir!, baseSha, headSha);
    expect(first).toEqual(await computeDiffIdentity(repoDir!, baseSha, headSha));
    expect(first.diffSha256).toMatch(/^[0-9a-f]{64}$/);
    const empty = await computeDiffIdentity(repoDir!, baseSha, baseSha);
    expect(empty.diffSha256).not.toBe(first.diffSha256);
    expect(empty.headTree).toBe(empty.baseTree);
  });

  it("hashes exactly what the spec's command prints, run by hand", async () => {
    const emptyConfig = writeTempConfig("");
    const rawDiff = execFileSync(
      "git",
      ["-c", "core.quotepath=false", "-c", "diff.algorithm=myers", "diff", "--binary", "--no-ext-diff", "--no-color",
        "--no-renames", "--full-index", "--src-prefix=a/", "--dst-prefix=b/", baseSha, headSha],
      { cwd: repoDir, maxBuffer: 256 * 1024 * 1024, env: { ...process.env, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: emptyConfig } },
    );
    const identity = await computeDiffIdentity(repoDir!, baseSha, headSha);
    expect(identity.diffSha256).toBe(createHash("sha256").update(rawDiff).digest("hex"));
  });

  it("ignores the machine's global git config", async () => {
    const before = await computeDiffIdentity(repoDir!, baseSha, headSha);
    const noPrefixConfig = writeTempConfig("[diff]\n\tnoprefix = true\n");
    const previous = process.env.GIT_CONFIG_GLOBAL;
    process.env.GIT_CONFIG_GLOBAL = noPrefixConfig;
    try {
      expect(await computeDiffIdentity(repoDir!, baseSha, headSha)).toEqual(before);
    } finally {
      if (previous === undefined) delete process.env.GIT_CONFIG_GLOBAL;
      else process.env.GIT_CONFIG_GLOBAL = previous;
    }
  });

  it("rejects a value that is not a full SHA before it can reach git as an option", async () => {
    await expect(computeDiffIdentity(repoDir!, "--output=x", headSha)).rejects.toThrow();
  });

  it("reads a file at both commits, and null where it doesn't exist", async () => {
    const { files } = await loadDiff(repoDir!, baseSha, headSha);
    const edited = files.find((file) => file.removed > 0)!;
    const atBase = await readFileAtCommit(repoDir!, baseSha, edited.path);
    expect(atBase).toContain("\n");
    expect(await readFileAtCommit(repoDir!, headSha, edited.path)).not.toBe(atBase);
    expect(await readFileAtCommit(repoDir!, baseSha, "no/such/file.cs")).toBeNull();
  });

  it("returns null for a folder, which has no file text", async () => {
    expect(await readFileAtCommit(repoDir!, baseSha, "src")).toBeNull();
  });

  it("fails loudly when the commit is unknown, not as a missing file", async () => {
    await expect(readFileAtCommit(repoDir!, "1".repeat(40), "README.md")).rejects.toThrow(/cat-file/);
  });
});
