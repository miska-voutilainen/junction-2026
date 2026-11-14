import { Console } from "@/components/Console";
import { coverageLabel } from "@/contracts";
import { cn } from "@/lib/utils";
import type { LedgerRow } from "./receiptModel";

/**
 * Hunk ledger: every hunk of the signed diff, what covered it, and who read it.
 * One mono line per hunk in aligned columns, in a console so a long path scrolls
 * inside the box and Copy takes the plain text. Hunks a person read come first
 * and are amber, the same signal as the coverage gutter on the review page.
 */
export function HunkLedger({ rows }: { rows: LedgerRow[] }) {
  const lines = ledgerLines(rows);
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-medium text-text-muted">Hunk ledger</h2>
      <Console label="Hunk ledger" kind="output" text={lines.map((line) => line.text).join("\n")}>
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
  const locationWidth = Math.max(...rows.map((row) => row.location.length));
  const coverageWidth = Math.max(...rows.map((row) => coverageLabel[row.coverage].length));
  return rows.map((row) => {
    const columns = [row.location.padEnd(locationWidth), coverageLabel[row.coverage].padEnd(coverageWidth)];
    if (row.readBy !== null) columns.push(`Read by ${row.readBy}`);
    return { hunkId: row.hunkId, text: columns.join("  ").trimEnd(), isRead: row.coverage === "read" };
  });
}
