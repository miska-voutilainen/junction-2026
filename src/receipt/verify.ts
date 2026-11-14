/**
 * Signed receipt in git, the merge gate: a receipt counts only if its signature
 * verifies against allowed_signers and the diff it was signed over is the diff
 * under review now. The exit code is what a CI step would gate on. Spec section 5,
 * Receipt CLI, verify.
 */

import { ReceiptSchema, type Receipt } from "@/contracts/receipt";
import { computeDiffIdentity } from "@/lib/git";
import { CommandError, isSameDiff, readChangeInput, type ReceiptOptions } from "./context";
import { listNotes, readNote, type NoteEntry } from "./notes";
import { checkSignature } from "./signature";

const signatureMarker = "-----BEGIN SSH SIGNATURE-----";

/** A receipt that passed every check, with what `export` needs to record it. */
export type VerifiedReceipt = {
  receipt: Receipt;
  signature: string;
  lines: string[];
};

/** A note split into the signed payload and its armored signature. */
type ParsedNote = {
  payload: Buffer;
  signature: string;
  claimed: Record<string, unknown>;
};

/**
 * Verifies the newest receipt for `changeId`.
 *
 * @throws CommandError exit 2 when no receipt exists, exit 3 when the signature or the
 *   payload is invalid, exit 1 when the diff changed since signing or inputs are missing.
 */
export async function verifyReceipt(
  changeId: string,
  options: ReceiptOptions,
): Promise<VerifiedReceipt> {
  const change = await readChangeInput(options, changeId);
  const note = await findNewestNote(changeId, change.headSha, options);

  const owner = note.claimed.owner;
  if (typeof owner !== "string")
    throw new CommandError(3, "Signature invalid: the receipt names no owner");
  const check = await checkSignature(note.payload, note.signature, owner, options);
  if (!check.isValid) throw new CommandError(3, `Signature invalid: ${check.reason}`);
  const parsed = ReceiptSchema.safeParse(note.claimed);
  if (!parsed.success)
    throw new CommandError(3, "Signature invalid: the signed payload is not a valid receipt");
  const receipt = parsed.data;

  const current = await computeDiffIdentity(options.repoDir, change.baseSha, change.headSha);
  if (!isSameDiff(receipt, change.headSha, current))
    throw new CommandError(
      1,
      `Stale: the diff changed since signing. Run pnpm review run ${changeId}, then pnpm countersign draft ${changeId} --force and sign it again.`,
    );

  return {
    receipt,
    signature: note.signature,
    lines: [check.goodLine, "diff unchanged"],
  };
}

/**
 * Picks the receipt note for this change with the latest `signedAt`. Notes for other
 * changes, or not receipts at all, are skipped; an unreadable note on this change's
 * own head commit is a failed signature, not "no receipt".
 */
async function findNewestNote(
  changeId: string,
  headSha: string,
  options: ReceiptOptions,
): Promise<ParsedNote> {
  let newest: ParsedNote | null = null;
  for (const entry of await listNotes(options.repoDir)) {
    const note = parseNote(await readNote(options.repoDir, entry));
    if (note === null) {
      if (entry.annotated === headSha) throw unreadableNote(entry);
      continue;
    }
    if (note.claimed.changeId !== changeId) continue;
    if (newest === null || isLater(note, newest)) newest = note;
  }
  if (newest === null)
    throw new CommandError(
      2,
      `No receipt for ${changeId}. Run pnpm countersign sign ${changeId} first.`,
    );
  return newest;
}

function unreadableNote(entry: NoteEntry): CommandError {
  return new CommandError(
    3,
    `Signature invalid: the note on ${entry.annotated} is not a signed receipt`,
  );
}

/**
 * `signedAt` values are toISOString() UTC strings, which sort in time order as
 * text. A forged note with a later claim wins here and then fails its signature
 * check: verify fails closed with exit 3, by decision, instead of falling back
 * to an older receipt.
 */
function isLater(note: ParsedNote, other: ParsedNote): boolean {
  return signedAtOf(note) > signedAtOf(other);
}

function signedAtOf(note: ParsedNote): string {
  return typeof note.claimed.signedAt === "string" ? note.claimed.signedAt : "";
}

/**
 * Where the signature starts: the marker at the very start of a line. Searching
 * for a newline plus the marker keeps a marker string inside a JSON field from
 * splitting the note (canonical JSON escapes newlines in strings, so a real line
 * start is never inside the payload).
 */
function signatureStart(bytes: Buffer): number {
  if (bytes.subarray(0, signatureMarker.length).toString("utf8") === signatureMarker) return 0;
  const afterNewline = bytes.indexOf(`\n${signatureMarker}`);
  return afterNewline === -1 ? -1 : afterNewline + 1;
}

/** Splits at the signature marker line; everything before it is the payload, byte for byte. */
function parseNote(bytes: Buffer): ParsedNote | null {
  const marker = signatureStart(bytes);
  if (marker === -1) return null;
  const payload = bytes.subarray(0, marker);
  try {
    const claimed: unknown = JSON.parse(payload.toString("utf8"));
    if (claimed === null || typeof claimed !== "object" || Array.isArray(claimed)) return null;
    return {
      payload,
      signature: bytes.subarray(marker).toString("utf8"),
      claimed: claimed as Record<string, unknown>,
    };
  } catch {
    return null;
  }
}
