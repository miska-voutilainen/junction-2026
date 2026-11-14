import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ReceiptSchema, type Receipt } from "@/contracts/receipt";
import { computeDiffIdentity } from "@/lib/git";
import { CommandError, readChangeInput, signatureNamespace, type ReceiptOptions } from "./context";
import { listNotes, readNote, type NoteEntry } from "./notes";
import { runSshKeygen } from "./sshKeygen";

/**
 * Signed receipt in git, the merge gate: a receipt counts only if its signature
 * verifies against allowed_signers and the diff it was signed over is the diff
 * under review now. The exit code is what a CI step would gate on. Spec section 5,
 * Receipt CLI, verify.
 */

const signatureMarker = "-----BEGIN SSH SIGNATURE-----";

/** A receipt that passed every check, with what `export` needs to record it. */
export type VerifiedReceipt = { receipt: Receipt; signature: string; lines: string[] };

/** A note split into the signed payload and its armored signature. */
type ParsedNote = { payload: Buffer; signature: string; claimed: Record<string, unknown> };

/**
 * Verifies the newest receipt for `changeId`.
 *
 * @throws CommandError exit 2 when no receipt exists, exit 3 when the signature or the
 *   payload is invalid, exit 1 when the diff changed since signing or inputs are missing.
 */
export async function verifyReceipt(changeId: string, options: ReceiptOptions): Promise<VerifiedReceipt> {
  const change = await readChangeInput(options, changeId);
  const note = await findNewestNote(changeId, change.headSha, options);

  const goodLine = await checkSignature(note, options);
  const parsed = ReceiptSchema.safeParse(note.claimed);
  if (!parsed.success) throw new CommandError(3, "Signature invalid: the signed payload is not a valid receipt");
  const receipt = parsed.data;

  const current = await computeDiffIdentity(options.repoDir, change.baseSha, change.headSha);
  const isCurrent =
    receipt.commit === change.headSha &&
    receipt.baseTree === current.baseTree &&
    receipt.headTree === current.headTree &&
    receipt.diffSha256 === current.diffSha256;
  if (!isCurrent) throw new CommandError(1, "Stale: the diff changed since signing");

  return { receipt, signature: note.signature, lines: [goodLine, "diff unchanged"] };
}

/**
 * Picks the receipt note for this change with the latest `signedAt`. Notes for other
 * changes, or not receipts at all, are skipped; an unreadable note on this change's
 * own head commit is a failed signature, not "no receipt".
 */
async function findNewestNote(changeId: string, headSha: string, options: ReceiptOptions): Promise<ParsedNote> {
  let newest: ParsedNote | null = null;
  for (const entry of await listNotes(options.repoDir)) {
    const note = parseNote(await readNote(options.repoDir, entry));
    if (note === null) {
      if (entry.annotated === headSha) throw unreadableNote(entry);
      continue;
    }
    if (note.claimed.changeId !== changeId) continue;
    if (newest === null || signedAtOf(note) > signedAtOf(newest)) newest = note;
  }
  if (newest === null) throw new CommandError(2, `No receipt for ${changeId}`);
  return newest;
}

function unreadableNote(entry: NoteEntry): CommandError {
  return new CommandError(3, `Signature invalid: the note on ${entry.annotated} is not a signed receipt`);
}

function signedAtOf(note: ParsedNote): string {
  return typeof note.claimed.signedAt === "string" ? note.claimed.signedAt : "";
}

/** Splits at the signature marker line; everything before it is the payload, byte for byte. */
function parseNote(bytes: Buffer): ParsedNote | null {
  const marker = bytes.indexOf(signatureMarker);
  const startsLine = marker === 0 || (marker > 0 && bytes[marker - 1] === 0x0a);
  if (!startsLine) return null;
  const payload = bytes.subarray(0, marker);
  try {
    const claimed: unknown = JSON.parse(payload.toString("utf8"));
    if (claimed === null || typeof claimed !== "object" || Array.isArray(claimed)) return null;
    return { payload, signature: bytes.subarray(marker).toString("utf8"), claimed: claimed as Record<string, unknown> };
  } catch {
    return null;
  }
}

/** Runs `ssh-keygen -Y verify` with the payload on stdin and returns its "Good ..." line. */
async function checkSignature(note: ParsedNote, options: ReceiptOptions): Promise<string> {
  const owner = note.claimed.owner;
  if (typeof owner !== "string") throw new CommandError(3, "Signature invalid: the receipt names no owner");
  const folder = await mkdtemp(join(tmpdir(), "countersign-verify-"));
  try {
    const signaturePath = join(folder, "receipt.sig");
    await writeFile(signaturePath, note.signature);
    const result = await runSshKeygen(
      options.sshKeygenPath,
      ["-Y", "verify", "-f", options.allowedSignersPath, "-I", owner, "-n", signatureNamespace, "-s", signaturePath],
      { stdin: note.payload, cwd: folder },
    );
    if (result.code !== 0) throw new CommandError(3, `Signature invalid: ${result.stderr.trim() || result.stdout.trim()}`);
    return result.stdout.trim();
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
}
