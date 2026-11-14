import { checkedByLabel } from "@/contracts";
import type { Review } from "@/contracts";

type ReceiptBody = Review["receiptDraft"];

/**
 * The three parts of a receipt in the signer's words: what was checked and by
 * whom or what, what was not checked and why, and the residual risk the owner
 * accepts. The same view shows the AI's draft and a signed receipt, so a
 * person reads what they would sign exactly as it will be recorded.
 * Spec section 3, S2 Receipt.
 *
 * @param review The review on screen, to name the accepted refusals by rule id.
 * @param signedRunId The run a signed receipt was signed against; absent for the AI's draft, which is always this run's.
 */
export function ReceiptSections({ body, review, signedRunId }: Readonly<{ body: ReceiptBody; review: Review; signedRunId?: string }>) {
  const isSigned = signedRunId !== undefined;
  // Refusal ids are numbered per run: another run's "r2" may be another refusal, so those stay bare ids.
  const isSameRun = signedRunId === undefined || signedRunId === review.run.id;
  const acceptedIds = body.residualRisk.acceptedRefusalIds;
  const acceptedLabels = isSameRun
    ? review.refusals.filter((refusal) => acceptedIds.includes(refusal.id)).map((refusal) => refusal.ruleId)
    : acceptedIds;
  return (
    <div className="flex flex-col gap-4">
      <Section heading="Checked" emptyText={isSigned ? "The signer listed nothing as checked." : "Nothing listed yet. You add what you checked when you draft the receipt."}>
        {body.checked.map((entry) => (
          <li key={entry.item} className="text-sm text-text-secondary">
            {entry.item} <span className="text-xs text-text-muted">· {checkedByLabel[entry.by]}</span>
          </li>
        ))}
      </Section>
      <Section heading="Not checked" emptyText={isSigned ? "The signer listed nothing as unchecked." : "Nothing listed as unchecked."}>
        {body.notChecked.map((entry) => (
          <li key={entry.item} className="text-sm text-text-secondary">
            <span data-written-text>{entry.item}</span> <span data-written-text className="text-xs text-text-muted">· {entry.reason}</span>
          </li>
        ))}
      </Section>
      <section aria-label="Residual risk" className="flex flex-col gap-1">
        <h4 className="text-xs font-medium text-text-muted">Residual risk</h4>
        <p data-written-text className="text-sm text-text-secondary">{body.residualRisk.text}</p>
        {acceptedLabels.length > 0 && (
          <p className="text-xs text-text-muted">
            Accepts the refused items {acceptedLabels.join(", ")}
            {isSameRun ? "." : ` (recorded in run ${signedRunId}).`}
          </p>
        )}
      </section>
    </div>
  );
}

function Section({ heading, emptyText, children }: Readonly<{ heading: string; emptyText: string; children: React.ReactNode[] }>) {
  return (
    <section aria-label={heading} className="flex flex-col gap-1">
      <h4 className="text-xs font-medium text-text-muted">{heading}</h4>
      {children.length === 0 ? <p className="text-sm text-text-muted">{emptyText}</p> : <ul className="flex flex-col gap-1.5">{children}</ul>}
    </section>
  );
}
