import { ShieldCheck, ShieldX } from "lucide-react";
import { Console } from "@/components/Console";
import { Disclosure } from "@/components/Disclosure";
import type { ReceiptDocumentView } from "./receiptModel";

/**
 * How anyone can check the receipt: the verify command with the output
 * recorded when the receipt was exported, one line saying what that output
 * means, and the exported record itself, collapsed, for Copy.
 */
export function VerifySection({ view }: { view: ReceiptDocumentView }) {
  const Icon = view.status === "unverified" ? ShieldX : ShieldCheck;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-text-muted">Verify</h2>
      <Console label="countersign verify" kind="output" text={view.verifyText} defaultWrap />
      <p className="flex items-start gap-1.5 text-sm text-text-secondary">
        <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        {view.verifyLine}
      </p>
      <Disclosure title="Receipt JSON">
        <Console label="Receipt JSON" kind="log" text={view.recordJson} />
      </Disclosure>
    </section>
  );
}
