import Link from "next/link";
import { ShieldX } from "lucide-react";
import { DashboardSection } from "./DashboardSection";
import type { AcceptedRisk, RiskStatus } from "./dashboardModel";

const ROW_COLUMNS =
  "compact:grid compact:grid-cols-[minmax(0,1fr)_12rem_8rem_12rem] compact:items-start compact:gap-x-6";
const SIGNED_DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

// Only the states that ask for action get a colour; unverified also gets an icon, so colour is never the only cue.
const STATUS: Record<RiskStatus, { text: string; className: string }> = {
  signed: { text: "Holds: code unchanged", className: "text-text-secondary" },
  stale: { text: "Stale: code changed", className: "text-amber-light" },
  unverified: { text: "Signature failed verification", className: "text-rose-light" },
};

/**
 * Residual-risk lines from the receipts, in the signer's own words. A line
 * "Holds" while the signature verifies and the code is the code that was signed;
 * once the change is amended it is "Stale", and if the recorded check failed it
 * is "Signature failed verification". Neither carries the signer's acceptance.
 * Rows stack on a phone and become a table from 760 px.
 */
export function AcceptedRiskTable({ risks }: Readonly<{ risks: AcceptedRisk[] }>) {
  return (
    <DashboardSection
      title="Accepted risk"
      subtitle="Residual risk lines from signed receipts, and whether their code still holds"
    >
      <div
        role="table"
        aria-label="Accepted risk"
        className="overflow-hidden rounded-page border border-border-subtle bg-surface-panel"
      >
        <div
          role="row"
          className={`border-b border-border-subtle px-4 py-2.5 text-xs text-text-muted max-compact:sr-only ${ROW_COLUMNS}`}
        >
          <span role="columnheader">Risk, in the signer&apos;s words</span>
          <span role="columnheader">Accepted by</span>
          <span role="columnheader">Change</span>
          <span role="columnheader">Status</span>
        </div>
        {risks.map((risk) => (
          <div
            key={risk.changeId}
            role="row"
            className={`flex flex-col gap-1.5 border-b border-border-subtle px-4 py-3 text-sm last:border-b-0 ${ROW_COLUMNS}`}
          >
            <span role="cell" data-written-text className="min-w-0 text-text-primary">
              {risk.text}
            </span>
            <span role="cell" className="min-w-0 break-words text-text-secondary">
              {risk.owner}
              <span className="text-text-muted">
                {" "}
                · {SIGNED_DATE.format(new Date(risk.signedAt))}
              </span>
            </span>
            <span role="cell">
              <Link
                href={`/changes/${risk.changeId}`}
                className="font-mono text-xs text-link underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
              >
                {risk.changeId}
              </Link>
            </span>
            <span role="cell" className={STATUS[risk.status].className}>
              {risk.status === "unverified" && (
                <ShieldX aria-hidden="true" className="mr-1 inline size-3.5 align-text-bottom" />
              )}
              {STATUS[risk.status].text}
            </span>
          </div>
        ))}
      </div>
    </DashboardSection>
  );
}
