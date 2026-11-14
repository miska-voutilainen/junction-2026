import { ShieldX, TriangleAlert } from "lucide-react";
import { Console } from "@/components/Console";
import { STALE_BODY, STALE_TITLE, verifyLine } from "@/lib/receiptCopy";
import type { ReceiptDocumentView } from "./receiptModel";

/**
 * The warning above a receipt that no longer vouches for the diff. Stale
 * (amber): the code changed after signing, so it shows the signed hash against
 * the reviewed one (cut to 12 characters; the full hashes are in the identity
 * list) and the command for a fresh receipt. Unverified (rose): the signature
 * check failed on export, so it shows that recorded output. Each carries an
 * icon so the state is never colour alone.
 */
export function ReceiptNotice({ view }: Readonly<{ view: ReceiptDocumentView }>) {
  if (view.status === "stale" && view.staleHashes) return <StaleNotice view={view} hashes={view.staleHashes} />;
  if (view.status === "unverified") return <UnverifiedNotice view={view} />;
  return null;
}

function StaleNotice({ view, hashes }: Readonly<{ view: ReceiptDocumentView; hashes: { signedDiff: string; reviewedDiff: string } }>) {
  // Labels first and padded to one width, so the hashes line up and nothing wraps at 320 px.
  const hashLines = `Signed diff    ${hashes.signedDiff}\nReviewed diff  ${hashes.reviewedDiff}`;
  return (
    <section aria-labelledby="stale-title" className="flex flex-col gap-3 rounded-page border border-amber/50 bg-surface-panel p-4 compact:p-5">
      <h2 id="stale-title" className="flex items-start gap-2 text-md font-semibold text-amber-light">
        <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        {STALE_TITLE}
      </h2>
      <p className="text-text-secondary">{STALE_BODY}</p>
      <Console label="Diff hashes" kind="diff" text={hashLines} />
      <Console label="Sign command" kind="output" text={view.signCommand} />
    </section>
  );
}

function UnverifiedNotice({ view }: Readonly<{ view: ReceiptDocumentView }>) {
  return (
    <section aria-labelledby="unverified-title" className="flex flex-col gap-3 rounded-page border border-rose/50 bg-surface-panel p-4 compact:p-5">
      <h2 id="unverified-title" className="flex items-start gap-2 text-md font-semibold text-rose-light">
        <ShieldX aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        {verifyLine("unverified")}
      </h2>
      <Console label="countersign verify" kind="output" text={view.verifyText} defaultWrap />
    </section>
  );
}
