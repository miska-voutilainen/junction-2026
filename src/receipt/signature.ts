/**
 * Checks an armored SSH signature over a payload against allowed_signers for one
 * owner in the receipt namespace. `sign` runs it before writing a note (so a
 * wrong key never produces a receipt) and `verify` runs it as the merge gate.
 */

import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { signatureNamespace, withTempFolder, type ReceiptOptions } from "./context";
import { runSshKeygen, toSshPath } from "./sshKeygen";

/** The outcome of one `ssh-keygen -Y verify`: its "Good ..." line, or why it failed. */
export type SignatureCheck =
  { isValid: true; goodLine: string } | { isValid: false; reason: string };

/**
 * Runs `ssh-keygen -Y verify -f <allowed_signers> -I <owner> -n countersign-receipt`
 * with the payload on stdin. A signature made under another namespace or by a key
 * not listed for `owner` fails.
 */
export function checkSignature(
  payload: Buffer | string,
  signature: string,
  owner: string,
  options: ReceiptOptions,
): Promise<SignatureCheck> {
  return withTempFolder("countersign-verify-", async (folder) => {
    const signaturePath = join(folder, "receipt.sig");
    await writeFile(signaturePath, signature);
    const result = await runSshKeygen(
      options.sshKeygenPath,
      [
        "-Y",
        "verify",
        "-f",
        toSshPath(options.allowedSignersPath),
        "-I",
        owner,
        "-n",
        signatureNamespace,
        "-s",
        toSshPath(signaturePath),
      ],
      { stdin: Buffer.from(payload), cwd: folder },
    );
    if (result.code !== 0) {
      return { isValid: false, reason: result.stderr.trim() || result.stdout.trim() };
    }
    return { isValid: true, goodLine: result.stdout.trim() };
  });
}
