import { ShieldX, TriangleAlert } from "lucide-react";
import { Console } from "@/components/Console";
import type { ReceiptDocumentView } from "./receiptModel";

/**
 * The warning above a receipt that no longer vouches for the diff. Stale
 * (amber): the code changed after signing, so it shows the signed hash against
 * the current one and the command for a fresh receipt. Unverified (rose): the
 * signature check failed on export, so it shows that recorded output. Each
 * carries an icon so the state is never colour alone.
 */
export function ReceiptNotice({ view }: { view: ReceiptDocumentView }) {
  if (view.status === "stale" && view.staleHashes) return <StaleNotice view={view} hashes={view.staleHashes} />;
  if (view.status === "unverified") return <UnverifiedNotice view={view} />;
  return null;
}

function StaleNotice({ view, hashes }: { view: ReceiptDocumentView; hashes: { signed: string; current: string } }) {
  const hashDiff = `- ${hashes.signed}  signed\n+ ${hashes.current}  current`;
  return (
    <section aria-labelledby="stale-title" className="flex flex-col gap-3 rounded-page border border-amber/50 bg-surface-panel p-4 compact:p-5">
      <h2 id="stale-title" className="flex items-start gap-2 text-md font-semibold text-amber-light">
        <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        The code changed after signing. This receipt no longer covers the diff.
      </h2>
      <Console label="diffSha256, signed and current" kind="diff" text={hashDiff} defaultWrap />
      <p className="text-text-secondary">Review the new diff, then sign a fresh receipt:</p>
      <Console label="sign command" kind="output" text={view.signCommand} />
    </section>
  );
}

function UnverifiedNotice({ view }: { view: ReceiptDocumentView }) {
  return (
    <section aria-labelledby="unverified-title" className="flex flex-col gap-3 rounded-page border border-rose/50 bg-surface-panel p-4 compact:p-5">
      <h2 id="unverified-title" className="flex items-start gap-2 text-md font-semibold text-rose-light">
        <ShieldX aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        The signature check failed when this receipt was exported.
      </h2>
      <Console label="countersign verify" kind="output" text={view.verifyText} defaultWrap />
    </section>
  );
}
