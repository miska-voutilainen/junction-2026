import type { ReactNode } from "react";
import type { ReceiptDocumentView } from "./receiptModel";

const NOTHING_LISTED = "Nothing listed.";

// Signed lines quote file paths ("src/MessagePack.SourceGenerator/CodeAnalysis/TypeCollector.cs")
// with no space to break at; without this they push a 375 px page 200 px sideways.
const SIGNED_TEXT = "text-md text-text-primary [overflow-wrap:anywhere]";

/**
 * The signer's three sections: Checked, Not checked and Residual risk. The
 * text is what a person signed, so it is set in sans; only rule ids are mono.
 * Accepted refusals read "<rule id> · <rule title>" from the refusal policy.
 */
export function SignedSections({ view }: Readonly<{ view: ReceiptDocumentView }>) {
  const { checked, notChecked, residualRisk } = view;
  return (
    <>
      <Section title="Checked">
        {checked.length === 0 ? (
          <p className="text-text-muted">{NOTHING_LISTED}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {checked.map(({ item, by }) => (
              <li key={item} className="flex flex-col gap-0.5 compact:flex-row compact:justify-between compact:gap-6">
                <span className={`min-w-0 ${SIGNED_TEXT}`}>{item}</span>
                <span className="shrink-0 text-sm text-text-muted">{by}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title="Not checked">
        {notChecked.length === 0 ? (
          <p className="text-text-muted">{NOTHING_LISTED}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {notChecked.map(({ item, reason }) => (
              <li key={item} className="flex flex-col gap-0.5">
                <span className={SIGNED_TEXT}>{item}</span>
                <span className="text-sm text-text-muted">{reason}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title="Residual risk">
        <p data-written-text className={SIGNED_TEXT}>{residualRisk.text}</p>
        {residualRisk.accepted.length > 0 && (
          <ul aria-label="Accepted refusals" className="flex flex-col gap-1 text-sm text-text-secondary">
            {residualRisk.accepted.map(({ refusalId, rule, runId }) => (
              <li key={refusalId}>
                {rule ? (
                  <>
                    <span className="font-mono text-text-primary">{rule.id}</span> · {rule.title}
                  </>
                ) : (
                  <>
                    <span className="font-mono text-text-primary">{refusalId}</span> · recorded in run <span className="font-mono">{runId}</span>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}

function Section({ title, children }: Readonly<{ title: string; children: ReactNode }>) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-medium text-text-muted">{title}</h2>
      {children}
    </section>
  );
}
