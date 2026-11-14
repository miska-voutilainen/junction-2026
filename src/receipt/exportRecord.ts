import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ReceiptRecordSchema, type ReceiptRecord } from "@/contracts/receipt";
import { notesRef, type ReceiptOptions } from "./context";
import { verifyReceipt } from "./verify";

/**
 * Writes `data/receipts/<changeId>.json`, the committed copy of a receipt the site
 * shows with its verify output. Only a receipt that verifies right now is exported,
 * so `verify.ok` in the file is a result, never a claim.
 *
 * @throws CommandError with verify's exit code, writing nothing, when verify fails.
 */
export async function exportReceipt(
  changeId: string,
  options: ReceiptOptions,
): Promise<string[]> {
  const { receipt, signature, lines } = await verifyReceipt(changeId, options);
  const record: ReceiptRecord = ReceiptRecordSchema.parse({
    schemaVersion: 1,
    changeId,
    receipt,
    signature,
    notesRef,
    verify: {
      command: `pnpm countersign verify ${changeId}`,
      output: lines.join("\n"),
      ok: true,
      verifiedAt: new Date().toISOString(),
    },
  });
  const folder = join(options.dataDir, "receipts");
  await mkdir(folder, { recursive: true });
  const path = join(folder, `${changeId}.json`);
  await writeFile(path, `${JSON.stringify(record, null, 2)}\n`);
  return [...lines, `Exported: ${path}`];
}
