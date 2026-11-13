import type { ReceiptStatusValue } from "@/lib/data/receiptStatus";

/**
 * Receipt state of a change as one line of text: "Needs review", "Signed by <owner>" or "Stale".
 * Stale is the only one drawn in amber because it is the only one that asks for action.
 * `owner` is the receipt's GitHub login and is shown only when signed.
 */
export function ReceiptStatus({ status, owner }: { status: ReceiptStatusValue; owner?: string }) {
  if (status === "stale") {
    return <span className="text-amber-light">Stale</span>;
  }
  if (status === "signed") {
    return <span className="text-text-secondary">Signed by {owner}</span>;
  }
  return <span className="text-text-secondary">Needs review</span>;
}
