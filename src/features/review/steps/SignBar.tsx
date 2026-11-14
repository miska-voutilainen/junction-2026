"use client";

import type { ReceiptStatusValue } from "@/lib/data/receiptStatus";

const LABEL: Record<ReceiptStatusValue, string> = {
  "needs-review": "Sign",
  stale: "Re-sign",
  unverified: "Check the signature",
  signed: "View receipt",
};

/**
 * The phone's Sign bar, fixed to the bottom of the screen while the steps
 * panel sits far down the page. It opens step 4; it cannot sign, because
 * signing happens in the owner's terminal. From 760 px the header's Sign
 * button and the `4` key do this job, so the bar is hidden.
 */
export function SignBar({ status, onOpenSign }: { status: ReceiptStatusValue; onOpenSign: () => void }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border-subtle bg-surface-panel px-4 py-3 compact:hidden">
      <button
        type="button"
        onClick={onOpenSign}
        className="h-10 w-full rounded-button bg-brand text-sm font-semibold text-primary-foreground transition-colors duration-(--duration-fast) hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring-on-brand"
      >
        {LABEL[status]}
      </button>
    </div>
  );
}
