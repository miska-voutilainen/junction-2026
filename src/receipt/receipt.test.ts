// @vitest-environment node
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ReceiptRecordSchema, ReceiptSchema } from "@/contracts/receipt";
import { ReviewSchema } from "@/contracts/review";
import { computeDiffIdentity } from "@/lib/git";
import { CommandError, type ReceiptOptions } from "./context";
import { draftReceipt } from "./draft";
import { exportReceipt } from "./exportRecord";
import { signReceipt } from "./sign";
import { defaultSshKeygenPath } from "./sshKeygen";
import { verifyReceipt } from "./verify";

/** Over a real temp git repo and a throwaway ssh key: git and ssh-keygen are not mocked. */

const changeId = "t-1";
const owner = "test-owner";
const slow = 60_000;

let root: string;
let options: ReceiptOptions;
let keyPath: string;
let shas: { a: string; b: string; c: string };

function run(cwd: string, command: string, args: string[]): string {
  return execFileSync(command, args, { cwd, encoding: "utf8" }).trim();
}

/** Commits the working tree and returns the new commit's sha. */
function commitAll(repoDir: string, message: string): string {
  run(repoDir, "git", ["add", "-A"]);
  run(repoDir, "git", ["commit", "-q", "-m", message]);
  return run(repoDir, "git", ["rev-parse", "HEAD"]);
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

const changeInputPath = () =>
  join(options.dataDir, "sample", "changes", `${changeId}.json`);

function changeInput(headSha: string) {
  return {
    id: changeId,
    kind: "tieto",
    title: "Test change",
    requirementId: "req-1",
    parentChangeId: null,
    repo: "example/repo",
    branch: "test",
    baseSha: shas.a,
    headSha,
    authorAgent: "test-agent",
    authorDescription: { text: "Test", synthetic: true, writtenBy: "test" },
  };
}

/** A review of A..B: the mp-2283 fixture with this repo's diff identity. */
async function writeReview(): Promise<void> {
  const fixture = JSON.parse(
    readFileSync(
      join(process.cwd(), "data/fixtures/runs/mp-2283/review.json"),
      "utf8",
    ),
  );
  const identity = await computeDiffIdentity(options.repoDir, shas.a, shas.b);
  const review = {
    ...fixture,
    changeId,
    diff: { ...fixture.diff, baseSha: shas.a, headSha: shas.b, ...identity },
  };
  ReviewSchema.parse(review);
  await writeJson(
    join(options.dataDir, "runs", changeId, "review.json"),
    review,
  );
}

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "countersign-receipt-test-"));
  const repoDir = join(root, "repo");
  await mkdir(repoDir);
  run(repoDir, "git", ["init", "-q"]);
  run(repoDir, "git", ["config", "user.name", "Test"]);
  run(repoDir, "git", ["config", "user.email", "test@example.com"]);
  await writeFile(join(repoDir, "f.txt"), "one\n");
  const a = commitAll(repoDir, "A");
  await writeFile(join(repoDir, "f.txt"), "one\ntwo\n");
  const b = commitAll(repoDir, "B");
  await writeFile(join(repoDir, "f.txt"), "one\ntwo\nthree\n");
  shas = { a, b, c: commitAll(repoDir, "C") };

  keyPath = join(root, "key");
  run(root, defaultSshKeygenPath, [
    "-q",
    "-t",
    "ed25519",
    "-N",
    "",
    "-C",
    "test",
    "-f",
    keyPath,
  ]);
  const publicKey = readFileSync(`${keyPath}.pub`, "utf8").trim();
  const allowedSignersPath = join(root, "allowed_signers");
  await writeFile(
    allowedSignersPath,
    `# comment line\n${owner} namespaces="countersign-receipt" ${publicKey}\n`,
  );

  options = {
    repoDir,
    dataDir: join(root, "data"),
    draftsDir: join(root, "drafts"),
    allowedSignersPath,
    sshKeygenPath: defaultSshKeygenPath,
  };
  await writeJson(changeInputPath(), changeInput(shas.b));
  await writeReview();
}, slow);

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

/** The exit code a command would end with: 0 on success, a CommandError's code, else the error text. */
async function exitCodeOf(promise: Promise<unknown>): Promise<number | string> {
  try {
    await promise;
    return 0;
  } catch (error) {
    return error instanceof CommandError ? error.exitCode : String(error);
  }
}

async function draftAndSign(): Promise<string[]> {
  await draftReceipt(changeId, options, { ownerOption: owner, force: true });
  return signReceipt(changeId, options, { keyOption: keyPath });
}

const showNote = (sha: string) =>
  run(options.repoDir, "git", ["notes", "--ref=countersign", "show", sha]);
const noteBlobOn = (sha: string) =>
  run(options.repoDir, "git", ["notes", "--ref=countersign", "list", sha]);
const pointChangeAt = (headSha: string) =>
  writeJson(changeInputPath(), changeInput(headSha));

// The tests share one repo and run in order: each leaves it as the next expects.
describe("receipt commands", () => {
  it(
    "drafts a schema-valid receipt with the hunk ledger",
    async () => {
      await draftReceipt(changeId, options, { ownerOption: owner });
      const draft = JSON.parse(
        readFileSync(join(options.draftsDir, `${changeId}.json`), "utf8"),
      );
      const parsed = ReceiptSchema.omit({ signedAt: true }).parse(draft);
      expect(parsed.hunks).toHaveLength(8);
      expect(
        parsed.hunks
          .filter((hunk) => hunk.readBy === owner)
          .map((hunk) => hunk.hunkId),
      ).toEqual(["h3", "h4"]);
      expect(
        parsed.hunks.every(
          (hunk) => (hunk.coverage === "read") === (hunk.readBy !== null),
        ),
      ).toBe(true);
      expect(parsed.commit).toBe(shas.b);
    },
    slow,
  );

  it(
    "refuses to overwrite a draft without --force",
    async () => {
      expect(
        await exitCodeOf(
          draftReceipt(changeId, options, { ownerOption: owner }),
        ),
      ).toBe(1);
    },
    slow,
  );

  it(
    "exits 2 when no receipt exists",
    async () => {
      expect(await exitCodeOf(verifyReceipt(changeId, options))).toBe(2);
    },
    slow,
  );

  it(
    "signs, then verifies with the diff unchanged",
    async () => {
      const lines = await draftAndSign();
      expect(lines[0]).toBe(
        `Signed. Verify: pnpm countersign verify ${changeId}`,
      );
      const verified = await verifyReceipt(changeId, options);
      expect(verified.lines[0]).toContain("Good");
      expect(verified.lines[1]).toBe("diff unchanged");
    },
    slow,
  );

  it(
    "refuses a second receipt on the same commit and leaves the note unchanged",
    async () => {
      const before = noteBlobOn(shas.b);
      expect(
        await exitCodeOf(
          signReceipt(changeId, options, { keyOption: keyPath }),
        ),
      ).toBe(4);
      expect(noteBlobOn(shas.b)).toBe(before);
    },
    slow,
  );

  it(
    "exports a schema-valid record after verify passes",
    async () => {
      await exportReceipt(changeId, options);
      const path = join(options.dataDir, "receipts", `${changeId}.json`);
      const record = ReceiptRecordSchema.parse(
        JSON.parse(readFileSync(path, "utf8")),
      );
      expect(record.verify.ok).toBe(true);
      expect(record.signature).toContain("BEGIN SSH SIGNATURE");
    },
    slow,
  );

  it(
    "exits 3 when one payload character changes after signing",
    async () => {
      const note = showNote(shas.b);
      // Flip the last hex digit of the first occurrence of the head sha, inside the signed payload.
      const flipped = note.replace(
        shas.b,
        shas.b.slice(0, -1) + (shas.b.endsWith("0") ? "1" : "0"),
      );
      const file = join(root, "tampered.txt");
      await writeFile(file, `${flipped}\n`);
      run(options.repoDir, "git", [
        "notes",
        "--ref=countersign",
        "add",
        "-f",
        "--no-stripspace",
        "-F",
        file,
        shas.b,
      ]);
      expect(await exitCodeOf(verifyReceipt(changeId, options))).toBe(3);
    },
    slow,
  );

  it(
    "exits 1 as stale, and exports nothing, when the change input moves to another head",
    async () => {
      run(options.repoDir, "git", [
        "notes",
        "--ref=countersign",
        "remove",
        shas.b,
      ]);
      await draftAndSign();
      await rm(join(options.dataDir, "receipts", `${changeId}.json`));
      await pointChangeAt(shas.c);

      expect(await exitCodeOf(verifyReceipt(changeId, options))).toBe(1);
      await expect(verifyReceipt(changeId, options)).rejects.toThrow(
        "Stale: the diff changed since signing",
      );
      expect(await exitCodeOf(exportReceipt(changeId, options))).toBe(1);
      expect(
        existsSync(join(options.dataDir, "receipts", `${changeId}.json`)),
      ).toBe(false);
      await pointChangeAt(shas.b);
    },
    slow,
  );
});

describe("receipt refusals", () => {
  it(
    "exits 1 when the review was recorded for another diff",
    async () => {
      await pointChangeAt(shas.c);
      await expect(
        draftReceipt(changeId, options, { ownerOption: owner, force: true }),
      ).rejects.toThrow("Review is stale: re-run the pipeline");
      await pointChangeAt(shas.b);
    },
    slow,
  );

  it(
    "exits 1 when the owner is not in allowed_signers",
    async () => {
      await draftReceipt(changeId, options, {
        ownerOption: "someone-else",
        force: true,
      });
      await expect(
        signReceipt(changeId, options, { keyOption: keyPath }),
      ).rejects.toThrow("is not in");
    },
    slow,
  );

  it(
    "exits 1 without a draft",
    async () => {
      await expect(signReceipt("nope", options)).rejects.toThrow(
        "Run pnpm countersign draft nope first.",
      );
    },
    slow,
  );

  it(
    "exits 1 for a passphrase-protected key instead of waiting for a prompt",
    async () => {
      const encryptedKey = join(root, "encrypted");
      run(root, defaultSshKeygenPath, [
        "-q",
        "-t",
        "ed25519",
        "-N",
        "secret",
        "-f",
        encryptedKey,
      ]);
      await draftReceipt(changeId, options, {
        ownerOption: owner,
        force: true,
      });
      await expect(
        signReceipt(changeId, options, { keyOption: encryptedKey }),
      ).rejects.toThrow("Use an unencrypted demo key");
    },
    slow,
  );
});
