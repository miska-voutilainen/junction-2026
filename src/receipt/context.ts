import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ZodType } from "zod";
import { ChangeInputSchema, type ChangeInput } from "@/contracts/change";
import type { DiffIdentity } from "@/lib/git";

/** Where each command finds its inputs; the CLI fills it from the environment, tests from a temp folder. */
export type ReceiptOptions = {
  /** The sample fork's clone: holds the commits and `refs/notes/countersign`. */
  repoDir: string;
  /** The project's `data/` folder. */
  dataDir: string;
  /** Where drafts live: `<project root>/.scratch/receipts`. */
  draftsDir: string;
  allowedSignersPath: string;
  sshKeygenPath: string;
};

/** The git ref that holds signed receipts as notes on the head commit. */
export const notesRef = "refs/notes/countersign";

/** The ssh-keygen signature namespace; a signature made for anything else does not verify. */
export const signatureNamespace = "countersign-receipt";

/** A failure the CLI reports as one line and an exit code (spec 9.1: 1 input, 2 no receipt, 3 signature, 4 append-only). */
export class CommandError extends Error {
  constructor(
    readonly exitCode: number,
    message: string,
  ) {
    super(message);
    this.name = "CommandError";
  }
}

/** Path of the editable draft for a change. */
export function draftPath(options: ReceiptOptions, changeId: string): string {
  return join(options.draftsDir, `${changeId}.json`);
}

/**
 * Reads a JSON file and validates it, turning every failure into one line that
 * says what is wrong and what to do.
 *
 * @param kind what the file is, for messages: "draft", "change input", "review".
 * @param hint what to do when the file is unusable.
 * @param missing the message when the file does not exist.
 * @throws CommandError (exit 1) when the file is missing, not JSON, or fails the schema.
 */
export async function readValidatedJson<T>(
  path: string,
  kind: string,
  schema: ZodType<T>,
  { hint, missing }: { hint: string; missing: string },
): Promise<T> {
  const text = await readFile(path, "utf8").catch(() => {
    throw new CommandError(1, missing);
  });
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new CommandError(1, `Invalid ${kind} ${path}: not JSON. ${hint}`);
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
    throw new CommandError(1, `Invalid ${kind} ${path}: ${where}${issue.message}. ${hint}`);
  }
  return parsed.data;
}

/** Reads and validates `data/sample/changes/<changeId>.json`. */
export function readChangeInput(options: ReceiptOptions, changeId: string): Promise<ChangeInput> {
  const path = join(options.dataDir, "sample", "changes", `${changeId}.json`);
  return readValidatedJson(path, "change input", ChangeInputSchema, {
    hint: `Fix it or re-run pnpm seed.`,
    missing: `No change input for ${changeId}: expected ${path}.`,
  });
}

/**
 * Whether a receipt (or a draft) still describes the diff under review: the same
 * head commit and the same trees and diff hash, recomputed from git.
 */
export function isSameDiff(
  receipt: { commit: string; baseTree: string; headTree: string; diffSha256: string },
  headSha: string,
  current: DiffIdentity,
): boolean {
  return (
    receipt.commit === headSha &&
    receipt.baseTree === current.baseTree &&
    receipt.headTree === current.headTree &&
    receipt.diffSha256 === current.diffSha256
  );
}

/** Runs `fn` with a private temp folder and always removes it, whatever `fn` does. */
export async function withTempFolder<T>(
  prefix: string,
  fn: (folder: string) => Promise<T>,
): Promise<T> {
  const folder = await mkdtemp(join(tmpdir(), prefix));
  try {
    return await fn(folder);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
}
