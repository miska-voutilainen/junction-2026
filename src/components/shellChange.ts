import { tierLabel } from "@/contracts";
import type { InboxRow } from "@/features/inbox";
import type { ReceiptState } from "@/lib/receiptUnderEscapes";

/** What the shell needs to know about a change: the nav badge and the command menu rows. */
export type ShellChange = {
  id: string;
  title: string;
  requirementId: string;
  /** "Light", "Focused" or "Full"; null while the change has no routing yet. */
  tierLabel: string | null;
  /** The receipt status in words, e.g. "needs review". */
  statusLabel: string;
  needsReview: boolean;
};

const STATUS_LABEL: Record<ReceiptState, string> = {
  "needs-review": "needs review",
  signed: "signed",
  stale: "stale",
  reopened: "reopened by an escape",
  unverified: "signature failed verification",
};

/** The inbox rows as the shell wants them (nav badge, command menu), in inbox order. */
export function toShellChanges(rows: InboxRow[]): ShellChange[] {
  return rows.map((row) =>
    row.state === "reviewed"
      ? {
          id: row.id,
          title: row.title,
          requirementId: row.requirementId,
          tierLabel: tierLabel[row.tier],
          statusLabel: STATUS_LABEL[row.receipt],
          needsReview: row.receipt !== "signed",
        }
      : {
          id: row.id,
          title: row.title,
          requirementId: row.requirementId,
          tierLabel: null,
          statusLabel: row.state === "missing" ? "not reviewed" : "unreadable",
          needsReview: false,
        },
  );
}
