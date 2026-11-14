import type { ReactNode } from "react";
import { AreaChip } from "@/components/AreaChip";
import { Disclosure } from "@/components/Disclosure";
import { IdeaLabel } from "@/components/IdeaLabel";
import type { ReportCard } from "@/contracts";
import {
  failedQuotes,
  hallucinationLines,
  missedPlants,
  plantedTotal,
  retractedClaims,
  unknownRuleRefusals,
} from "./reportCardModel";
import type { ReviewOfChange } from "./reportCardModel";
import { countOf } from "@/lib/countOf";

/**
 * The three lists under the ladder: planted bugs the reviewer missed, what the
 * quote check caught, and claims it withdrew. Two scopes meet here, so each
 * list says which it covers: the eval's planted bugs and totals, or only the
 * recorded reviews of the four changes. A badge counts the items its card lists.
 *
 * @param hasRealVariants Whether the report card came from a real eval. A fixture's
 *   planted bugs are invented, so "View variant" would open a commit the fork doesn't have.
 */
export function ReportLists({
  reportCard,
  reviews,
  hasRealVariants,
}: Readonly<{ reportCard: ReportCard; reviews: ReviewOfChange[]; hasRealVariants: boolean }>) {
  const missed = missedPlants(reportCard);
  const planted = plantedTotal(reportCard);
  const quotes = failedQuotes(reviews);
  const unknownRules = unknownRuleRefusals(reviews);
  const retracted = retractedClaims(reviews);
  const inReviews = `In the ${countOf(reviews.length, "recorded review")}`;

  return (
    <div className="grid grid-cols-1 items-start gap-4 nav:grid-cols-2 wide:grid-cols-3">
      <ListCard title="Missed planted bugs" count={missed.length} defaultOpen>
        <Scope>
          Of {planted} planted bugs in the eval: {missed.length} missed
        </Scope>
        {missed.length === 0 ? (
          <p className="text-text-muted">The reviewer caught every planted bug.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border-subtle">
            {missed.map((plant) => (
              <li key={plant.plantId} className="flex flex-col gap-1.5 py-2.5 first:pt-0 last:pb-0">
                <span className="text-text-secondary">{plant.defect}</span>
                <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-text-muted">
                  <span className="font-mono">{plant.plantId}</span>
                  <AreaChip area={plant.area} />
                  {/* A fixture's planted bugs are invented, so their commits don't exist in the fork. */}
                  {hasRealVariants && (
                    <a
                      href={plant.variantUrl}
                      target="_blank"
                      rel="noopener"
                      aria-label={`View variant ${plant.plantId}, opens in a new tab`}
                      className="text-link hover:underline"
                    >
                      View variant
                    </a>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </ListCard>

      <ListCard title="Hallucinations caught" count={quotes.length + unknownRules.length} idea>
        <Scope>Across the eval runs and recorded reviews</Scope>
        <ul className="flex flex-col gap-1 text-text-secondary">
          {hallucinationLines(reportCard).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <div className="mt-3 border-t border-border-subtle pt-3">
          <Scope>
            {inReviews}: {countOf(quotes.length, "quote")} failed the check
          </Scope>
          {quotes.length > 0 && (
            <ul className="flex flex-col divide-y divide-border-subtle">
              {quotes.map((quote) => (
                <li
                  key={`${quote.changeId}-${quote.itemId}`}
                  className="flex flex-col gap-1 py-2.5 first:pt-0 last:pb-0"
                >
                  <span className="flex flex-wrap items-center gap-x-2.5 text-sm text-text-muted">
                    <span className="font-mono">{quote.changeId}</span>
                    <span className="font-mono break-all">{quote.location}</span>
                  </span>
                  <code className="font-mono text-sm break-words text-text-secondary">
                    {quote.quote}
                  </code>
                  <span data-written-text className="text-text-secondary">
                    {quote.reason}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="mt-3 border-t border-border-subtle pt-3">
          <Scope>
            {unknownRules.length === 0
              ? "Refusals struck for an unknown rule id"
              : `${inReviews}: ${countOf(unknownRules.length, "refusal")} struck for an unknown rule id`}
          </Scope>
          {unknownRules.length === 0 ? (
            <p className="text-text-muted">
              None in the {countOf(reviews.length, "recorded review")}.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-border-subtle">
              {unknownRules.map((refusal) => (
                <li
                  key={`${refusal.changeId}-${refusal.itemId}`}
                  className="flex flex-wrap items-baseline gap-x-2.5 py-2.5 text-text-secondary first:pt-0 last:pb-0"
                >
                  <span>Refusal {refusal.itemId} · unknown rule id</span>
                  <span className="font-mono text-sm text-text-muted">{refusal.changeId}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </ListCard>

      <ListCard title="Retracted claims" count={retracted.length}>
        <Scope>
          {inReviews}: {retracted.length}
        </Scope>
        {retracted.length === 0 ? (
          <p className="text-text-muted">No claim was retracted.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border-subtle">
            {retracted.map((claim) => (
              <li
                key={`${claim.changeId}-${claim.claimId}`}
                className="flex flex-col gap-1 py-2.5 first:pt-0 last:pb-0"
              >
                <span className="text-text-secondary">&ldquo;{claim.claimText}&rdquo;</span>
                <span className="text-sm text-text-muted">
                  <span className="font-mono">{claim.changeId}</span> ·{" "}
                  <span data-written-text>{claim.reason}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </ListCard>
    </div>
  );
}

function Scope({ children }: Readonly<{ children: ReactNode }>) {
  return <p className="mb-2 text-xs text-text-muted">{children}</p>;
}

function ListCard({
  title,
  count,
  idea = false,
  defaultOpen = false,
  children,
}: Readonly<{
  title: string;
  count: number;
  /** Shows the "Idea 4 · Quote check" label at the top of the open card (a link can't sit inside the disclosure button, and the column is too narrow to fit it beside the heading). */
  idea?: boolean;
  defaultOpen?: boolean;
  children: ReactNode;
}>) {
  return (
    <section className="rounded-page border border-border-subtle bg-surface-panel p-3 pb-4">
      <Disclosure
        defaultOpen={defaultOpen}
        title={
          <span className="flex items-center gap-2">
            <span className="font-semibold text-text-primary">{title}</span>
            <span className="rounded-chip bg-surface-control px-1.5 text-xs text-text-secondary">
              {count}
            </span>
          </span>
        }
      >
        <div className="px-1 pt-2">
          {idea && <IdeaLabel n={4} className="mb-2" />}
          {children}
        </div>
      </Disclosure>
    </section>
  );
}
