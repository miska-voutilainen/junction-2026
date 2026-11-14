import { ShieldX } from "lucide-react";
import type { ReceiptStatusValue } from "@/lib/data/receiptStatus";

/**
 * Receipt state of a change as one line of text: "Needs review", "Signed by <owner>",
 * "Stale" or "Signature failed verification".
 * Stale (amber) and failed verification (rose, with a shield-cross icon so the
 * state is not carried by colour alone) are the two that ask for action.
 * `owner` is the receipt's GitHub login and is shown only when signed.
 */
export function ReceiptStatus({ status, owner }: { status: ReceiptStatusValue; owner?: string }) {
  if (status === "unverified") {
    return (
      <span className="inline-flex items-center gap-1 text-rose-light">
        <ShieldX aria-hidden="true" className="size-3.5 shrink-0" />
        Signature failed verification
      </span>
    );
  }
  if (status === "stale") {
    return <span className="text-amber-light">Stale</span>;
  }
  if (status === "signed") {
    return <span className="text-text-secondary">Signed by {owner}</span>;
  }
  return <span className="text-text-secondary">Needs review</span>;
}
