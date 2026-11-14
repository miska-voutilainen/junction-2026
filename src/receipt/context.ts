import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ChangeInputSchema, type ChangeInput } from "@/contracts/change";

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
 * Reads and validates `data/sample/changes/<changeId>.json`.
 *
 * @throws CommandError (exit 1) when the file is missing or invalid.
 */
export async function readChangeInput(
  options: ReceiptOptions,
  changeId: string,
): Promise<ChangeInput> {
  const path = join(options.dataDir, "sample", "changes", `${changeId}.json`);
  const text = await readFile(path, "utf8").catch(() => {
    throw new CommandError(
      1,
      `No change input for ${changeId}: expected ${path}.`,
    );
  });
  const parsed = ChangeInputSchema.safeParse(JSON.parse(text));
  if (!parsed.success)
    throw new CommandError(
      1,
      `Invalid change input ${path}: ${parsed.error.message}`,
    );
  return parsed.data;
}
