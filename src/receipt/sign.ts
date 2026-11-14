import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { ReceiptSchema } from "@/contracts/receipt";
import { computeDiffIdentity } from "@/lib/git";
import { canonicalJson } from "./canonicalJson";
import {
  CommandError,
  draftPath,
  isSameDiff,
  readChangeInput,
  readValidatedJson,
  signatureNamespace,
  withTempFolder,
  type ReceiptOptions,
} from "./context";
import { DraftSchema, type Draft } from "./draft";
import { addNote, hasNote } from "./notes";
import { checkSignature } from "./signature";
import { runSshKeygen, toSshPath } from "./sshKeygen";

/**
 * Signed receipt in git, step 2: a named engineer signs. The signature covers the
 * canonical JSON of the receipt, which binds the diff identity and the hunk
 * ledger, and the result is stored as a git note on the head commit, so the proof
 * travels with the repository. The AI never reaches this step by itself: signing
 * needs the owner's key. Spec section 5, Receipt CLI; 9.1 for the formats.
 */

/** The default signing key, named in the spec. */
const defaultKeyPath = "~/.ssh/countersign_ed25519";

/**
 * Signs the owner's draft and attaches it as a note on the head commit.
 * Returns the lines to print.
 *
 * @throws CommandError exit 1 for a missing or invalid draft, an owner missing from
 *   allowed_signers, a missing or passphrase-protected key, or a stale review;
 *   exit 4 when the head commit already has a receipt.
 */
export async function signReceipt(
  changeId: string,
  options: ReceiptOptions,
  { keyOption }: { keyOption?: string } = {},
): Promise<string[]> {
  const draft = await readDraft(options, changeId);
  await requireListedSigner(draft.owner, options.allowedSignersPath);
  const keyPath = resolveKeyPath(keyOption ?? defaultKeyPath);
  await requireUnencryptedKey(keyPath, options.sshKeygenPath);

  if (await hasNote(options.repoDir, draft.commit)) {
    throw new CommandError(
      4,
      `A receipt already exists for ${draft.commit} (receipts are append-only)`,
    );
  }
  requireLedgerMatchesOwner(draft, changeId);
  await requireDraftMatchesCurrentDiff(draft, options, changeId);

  // The timestamp is set here, not in the draft: it records when the person signed.
  const receipt = ReceiptSchema.parse({
    ...draft,
    signedAt: new Date().toISOString(),
  });
  const payload = canonicalJson(receipt);
  const signature = await signPayload(payload, keyPath, options.sshKeygenPath);
  await requireKeyListedForOwner(payload, signature, keyPath, draft.owner, options);
  await attachNote(options.repoDir, payload + signature, draft.commit);

  return [
    `Signed. Verify: pnpm countersign verify ${changeId}`,
    `Publish: git -C ${options.repoDir} push origin refs/notes/countersign`,
  ];
}

function readDraft(options: ReceiptOptions, changeId: string): Promise<Draft> {
  return readValidatedJson(draftPath(options, changeId), "draft", DraftSchema, {
    hint: `Fix it or run pnpm countersign draft ${changeId} --force.`,
    missing: `No draft for ${changeId}. Run pnpm countersign draft ${changeId} first.`,
  });
}

/**
 * The ledger is part of what the owner signs: a hunk marked read must name the owner
 * as reader, and every other hunk must name no one. A hand-edited draft that breaks
 * this would sign a false reading record.
 */
function requireLedgerMatchesOwner(draft: Draft, changeId: string): void {
  const isConsistent = draft.hunks.every((hunk) =>
    hunk.coverage === "read" ? hunk.readBy === draft.owner : hunk.readBy === null,
  );
  if (!isConsistent) {
    throw new CommandError(
      1,
      `The hunk ledger doesn't match the owner ${draft.owner}: run pnpm countersign draft ${changeId} --force --owner ${draft.owner}`,
    );
  }
}

/** `~` resolves to the home folder, as a shell would; ssh-keygen itself does not expand it. */
function resolveKeyPath(keyPath: string): string {
  return resolve(keyPath.startsWith("~") ? join(homedir(), keyPath.slice(1)) : keyPath);
}

/** The owner must be a principal in allowed_signers, or verify could never succeed. Comment lines are skipped. */
async function requireListedSigner(owner: string, allowedSignersPath: string): Promise<void> {
  const text = await readFile(allowedSignersPath, "utf8").catch(() => {
    throw new CommandError(
      1,
      `No allowed_signers file at ${allowedSignersPath}. Add a line for ${owner}.`,
    );
  });
  const principals = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"))
    .flatMap((line) => line.split(/\s+/)[0].split(","));
  if (!principals.includes(owner)) {
    throw new CommandError(
      1,
      `${owner} is not in ${allowedSignersPath}. Add a line with their public key first.`,
    );
  }
}

/**
 * Fails early on a key ssh-keygen would prompt for. Exporting the public key with
 * an empty passphrase succeeds only for an unencrypted key.
 */
async function requireUnencryptedKey(keyPath: string, sshKeygenPath: string): Promise<void> {
  if (!existsSync(keyPath)) {
    throw new CommandError(
      1,
      `No signing key at ${keyPath}. Pass --key <path> or create one with ssh-keygen -t ed25519 -N "".`,
    );
  }
  const probe = await runSshKeygen(sshKeygenPath, ["-y", "-P", "", "-f", toSshPath(keyPath)]);
  if (probe.code !== 0) {
    throw new CommandError(
      1,
      `Use an unencrypted demo key (ssh-keygen -t ed25519 -N ""). ssh-keygen said: ${probe.stderr.trim()}`,
    );
  }
}

/** A draft made for another diff would sign claims about code the owner is not looking at. */
async function requireDraftMatchesCurrentDiff(
  draft: Draft,
  options: ReceiptOptions,
  changeId: string,
): Promise<void> {
  const change = await readChangeInput(options, changeId);
  const current = await computeDiffIdentity(options.repoDir, change.baseSha, change.headSha);
  if (!isSameDiff(draft, change.headSha, current))
    throw new CommandError(1, "Review is stale: re-run the pipeline");
}

/**
 * A key that is not the owner's would produce a note that fails verify forever.
 * Checking before the note is written keeps the append-only ref free of such notes.
 */
async function requireKeyListedForOwner(
  payload: string,
  signature: string,
  keyPath: string,
  owner: string,
  options: ReceiptOptions,
): Promise<void> {
  const check = await checkSignature(payload, signature, owner, options);
  if (!check.isValid) {
    throw new CommandError(
      1,
      `The key at ${keyPath} is not ${owner}'s key in ${options.allowedSignersPath}. Pass --key <path> to the key listed there.`,
    );
  }
}

/** Signs in a private temp folder with stdin closed. */
function signPayload(payload: string, keyPath: string, sshKeygenPath: string): Promise<string> {
  return withTempFolder("countersign-sign-", async (folder) => {
    await writeFile(join(folder, "receipt.json"), payload);
    const result = await runSshKeygen(
      sshKeygenPath,
      ["-Y", "sign", "-f", toSshPath(keyPath), "-n", signatureNamespace, "receipt.json"],
      { cwd: folder },
    );
    if (result.code !== 0)
      throw new CommandError(1, `ssh-keygen could not sign: ${result.stderr.trim()}`);
    return (await readFile(join(folder, "receipt.json.sig"), "utf8")).replace(/\r\n/g, "\n");
  });
}

function attachNote(repoDir: string, note: string, commit: string): Promise<void> {
  return withTempFolder("countersign-note-", async (folder) => {
    const noteFile = join(folder, "note.txt");
    await writeFile(noteFile, note);
    await addNote(repoDir, noteFile, commit);
  });
}
