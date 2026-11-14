import Link from "next/link";
import { Disclosure } from "@/components/Disclosure";
import { LevelLadder } from "@/components/LevelLadder";
import { ladderLevelLabel } from "@/contracts";

import type { AreaTrust } from "./dashboardModel";
import type { ReportCardInput } from "@/lib/decideChange";

/**
 * The reviewer's level per area (idea 1), after simulated escapes. The levels
 * come from the planted-bug eval, so the list links to the report card that
 * earned them. Without a report card every area is Shadow, and the section says why.
 */
export function TrustByArea({ trust, reportCard }: Readonly<{ trust: AreaTrust[]; reportCard: ReportCardInput }>) {
  return (
    <Disclosure
      title={
        <span className="flex flex-wrap items-baseline gap-x-3">
          <span className="font-semibold text-text-primary">Reviewer trust by area</span>
          <span className="text-sm text-text-muted">
            {trust.map((area) => `${area.label} ${ladderLevelLabel[area.level]}`).join(" · ")}
          </span>
        </span>
      }
    >
      {reportCard.state === "missing" && (
        <p className="px-1 pb-2 text-sm text-text-muted">No evaluation recorded yet, so every area counts as Shadow.</p>
      )}
      <ul className="flex flex-col divide-y divide-border-subtle overflow-hidden rounded-page border border-border-subtle bg-surface-panel">
        {trust.map((area) => (
          <li key={area.area} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 px-4 py-2.5 text-sm">
            <span className="font-medium">{area.label}</span>
            <LevelLadder level={area.level} />
          </li>
        ))}
      </ul>
      <Link
        href="/reviewer"
        className="mt-3 inline-block text-sm text-link underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
      >
        Open the report card
      </Link>
    </Disclosure>
  );
}
