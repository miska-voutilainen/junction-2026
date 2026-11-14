import { ReceiptSeal } from "@/components/ReceiptSeal";
import { Console } from "@/components/Console";
import { Disclosure } from "@/components/Disclosure";
import { HunkLedger } from "./HunkLedger";
import { IdentityList } from "./IdentityList";
import { ReceiptNotice } from "./ReceiptNotice";
import { ReceiptToolbar } from "./ReceiptToolbar";
import { SignedSections } from "./SignedSections";
import { VerifySection } from "./VerifySection";
import type { ReceiptDocumentView } from "./receiptModel";

/**
 * The receipt as a document a person can read and verify: toolbar, a notice when
 * it no longer vouches for the diff, then the card with the seal (signed only),
 * identity with the roles line, the signer's words, the signed hunk ledger and the signer. A stale or
 * unverified receipt shows what was signed but no seal.
 */
export function ReceiptDocument({ view }: Readonly<{ view: ReceiptDocumentView }>) {
  // The failed check is already in the notice; repeating it in a Verify section would say the same twice.
  const showVerify = view.status !== "unverified";

  return (
    <div className="flex flex-col gap-5">
      <ReceiptToolbar verifyCommand={view.verifyCommand} />
      <ReceiptNotice view={view} />
      <article aria-label={`Receipt for ${view.changeId}`} className="flex flex-col gap-7 rounded-page border border-border-default bg-surface-code p-5 compact:p-10">
        <header className="flex flex-col-reverse gap-5 compact:flex-row compact:items-start compact:gap-6">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="font-mono text-sm text-text-muted">
              {view.changeId} · {view.requirementId}
            </span>
            <h1 className="text-2xl font-semibold tracking-tight break-words">{view.title}</h1>
            {view.summary && <p className="text-text-muted">{view.summary}</p>}
          </div>
          {view.status === "signed" && <ReceiptSeal />}
        </header>
        <IdentityList rows={view.identity} roles={view.roles} />
        <SignedSections view={view} />
        {view.ledger.length > 0 && <HunkLedger rows={view.ledger} owner={view.owner} status={view.status} />}
        {showVerify && <VerifySection view={view} />}
        <Disclosure title="Receipt JSON">
          <Console label="Receipt JSON" kind="log" text={view.recordJson} />
        </Disclosure>
        <footer className="flex flex-col gap-0.5 border-t border-border-subtle pt-6">
          <span className="text-xl font-semibold break-words">{view.owner}</span>
          <span className="text-sm text-text-muted">Signed {view.signedAt}</span>
        </footer>
      </article>
      <p className="text-sm text-text-muted">
        Stored in git as a note under <span className="font-mono text-xs">refs/notes/countersign</span>. If the code changes after signing,
        this receipt goes stale and the inbox asks for a new signature.
      </p>
    </div>
  );
}
