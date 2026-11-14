import { Console } from "@/components/Console";
import { coverageLabel } from "@/contracts";
import { cn } from "@/lib/utils";
import type { LedgerRow, ReceiptDocumentStatus } from "./receiptModel";

/**
 * Hunk ledger: every hunk of the signed diff, what covered it, and who read it.
 * It is read from the receipt's signed payload, so the note under the heading
 * says the signature covers it. One mono line per hunk in aligned columns, in
 * a console so a long path scrolls inside the box and Copy takes the plain
 * text. Hunks a person read come first and are amber, the same signal as the
 * coverage gutter on the review page.
 *
 * When the recorded signature check failed, the heading drops "signed" and the
 * note says the signature failed, because nothing vouches for the ledger.
 *
 * @param owner The signer's login, named in the note.
 * @param status The receipt's state; "unverified" changes the heading and the note.
 */
export function HunkLedger({ rows, owner, status }: Readonly<{ rows: LedgerRow[]; owner: string; status: ReceiptDocumentStatus }>) {
  const isUnverified = status === "unverified";
  const lines = ledgerLines(rows);
  return (
    <section className="flex flex-col gap-2">
      <p className="text-sm text-text-muted">
        {isUnverified
          ? "The signature over this ledger failed verification."
          : `Part of the signed payload: the signature covers which hunks ${owner} read and which checks covered the rest.`}
      </p>
      <Console label={isUnverified ? "Hunk ledger" : "Hunk ledger · signed"} kind="output" text={lines.map((line) => line.text).join("\n")}>
        <div>
          {lines.map((line) => (
            <div key={line.hunkId} className={cn(line.isRead && "text-amber-light")}>
              {line.text}
            </div>
          ))}
        </div>
      </Console>
    </section>
  );
}

function ledgerLines(rows: LedgerRow[]): { hunkId: string; text: string; isRead: boolean }[] {
  const idWidth = Math.max(...rows.map((row) => row.hunkId.length));
  const fileWidth = Math.max(...rows.map((row) => row.file.length));
  const coverageWidth = Math.max(...rows.map((row) => coverageLabel[row.coverage].length));
  return rows.map((row) => {
    const columns = [row.hunkId.padEnd(idWidth), row.file.padEnd(fileWidth), coverageLabel[row.coverage].padEnd(coverageWidth)];
    if (row.readBy !== null) columns.push(`Read by ${row.readBy}`);
    return { hunkId: row.hunkId, text: columns.join("  ").trimEnd(), isRead: row.coverage === "read" };
  });
}
