import { ShieldCheck, ShieldX, TriangleAlert } from "lucide-react";
import { Console } from "@/components/Console";
import type { ReceiptDocumentView } from "./receiptModel";

/**
 * How anyone can check the receipt: the verify command with the output
 * recorded when the receipt was exported, and one line saying what that output
 * means for this diff.
 */
export function VerifySection({ view }: { view: ReceiptDocumentView }) {
  const Icon = { signed: ShieldCheck, unchecked: ShieldCheck, stale: TriangleAlert, unverified: ShieldX }[view.status];
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-text-muted">Verify</h2>
      <Console label="countersign verify" kind="output" text={view.verifyText} defaultWrap />
      <p className="flex items-start gap-1.5 text-sm text-text-secondary">
        <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        {view.verifyLine}
      </p>
    </section>
  );
}
