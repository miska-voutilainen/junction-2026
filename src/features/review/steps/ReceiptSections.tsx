import type { Review } from "@/contracts";

type ReceiptBody = Review["receiptDraft"];

const CHECKED_BY_LABEL = { tool: "tool", "ai-supported": "AI, supported", human: "human" } as const;

/**
 * The three parts of a receipt in the signer's words: what was checked and by
 * whom or what, what was not checked and why, and the residual risk the owner
 * accepts. The same view shows the AI's draft and a signed receipt, so a
 * person reads what they would sign exactly as it will be recorded.
 * Spec section 3, S2 Receipt.
 *
 * @param refusals The review's refusals, to name the accepted ones by rule id.
 */
export function ReceiptSections({ body, refusals }: { body: ReceiptBody; refusals: Review["refusals"] }) {
  const acceptedRules = refusals.filter((refusal) => body.residualRisk.acceptedRefusalIds.includes(refusal.id)).map((refusal) => refusal.ruleId);
  return (
    <div className="flex flex-col gap-4">
      <Section heading="Checked" emptyText="Nothing listed yet. You add what you checked when you draft the receipt.">
        {body.checked.map((entry) => (
          <li key={entry.item} className="text-sm text-text-secondary">
            {entry.item} <span className="text-xs text-text-muted">· {CHECKED_BY_LABEL[entry.by]}</span>
          </li>
        ))}
      </Section>
      <Section heading="Not checked" emptyText="Nothing listed as unchecked.">
        {body.notChecked.map((entry) => (
          <li key={entry.item} className="text-sm text-text-secondary">
            {entry.item} <span className="text-xs text-text-muted">· {entry.reason}</span>
          </li>
        ))}
      </Section>
      <section aria-label="Residual risk" className="flex flex-col gap-1">
        <h4 className="text-xs font-medium text-text-muted">Residual risk</h4>
        <p className="text-sm text-text-secondary">{body.residualRisk.text}</p>
        {acceptedRules.length > 0 && (
          <p className="text-xs text-text-muted">Accepts the refused items {acceptedRules.join(", ")}.</p>
        )}
      </section>
    </div>
  );
}

function Section({ heading, emptyText, children }: { heading: string; emptyText: string; children: React.ReactNode[] }) {
  return (
    <section aria-label={heading} className="flex flex-col gap-1">
      <h4 className="text-xs font-medium text-text-muted">{heading}</h4>
      {children.length === 0 ? <p className="text-sm text-text-muted">{emptyText}</p> : <ul className="flex flex-col gap-1.5">{children}</ul>}
    </section>
  );
}
