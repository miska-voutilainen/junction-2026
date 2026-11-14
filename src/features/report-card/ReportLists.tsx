import type { ReactNode } from "react";
import { AreaChip } from "@/components/AreaChip";
import { Disclosure } from "@/components/Disclosure";
import { IdeaLabel } from "@/components/IdeaLabel";
import type { ReportCard } from "@/contracts";
import { failedQuotes, hallucinationLines, missedPlants, retractedClaims } from "./reportCardModel";
import type { ReviewOfChange } from "./reportCardModel";

/**
 * The three lists under the ladder: planted bugs the reviewer missed, what the
 * quote check caught, and claims it withdrew. Two scopes meet here, so each
 * list says which it covers: the eval's planted bugs and totals, or only the
 * recorded reviews of the four changes. A badge counts the items its card lists.
 */
export function ReportLists({ reportCard, reviews }: { reportCard: ReportCard; reviews: ReviewOfChange[] }) {
  const missed = missedPlants(reportCard);
  const planted = reportCard.areas.reduce((sum, entry) => sum + entry.planted, 0);
  const quotes = failedQuotes(reviews);
  const retracted = retractedClaims(reviews);
  const inReviews = reviews.length === 1 ? "In the 1 recorded review" : `In the ${reviews.length} recorded reviews`;

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
                  <a
                    href={plant.variantUrl}
                    target="_blank"
                    rel="noopener"
                    aria-label={`View variant ${plant.plantId}, opens in a new tab`}
                    className="text-link hover:underline"
                  >
                    View variant
                  </a>
                </span>
              </li>
            ))}
          </ul>
        )}
      </ListCard>

      <ListCard title="Hallucinations caught" count={quotes.length} idea>
        <Scope>Across the eval runs and recorded reviews</Scope>
        <ul className="flex flex-col gap-1 text-text-secondary">
          {hallucinationLines(reportCard).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <div className="mt-3 border-t border-border-subtle pt-3">
          <Scope>
            {inReviews}: {quotes.length} quote{quotes.length === 1 ? "" : "s"} failed the check
          </Scope>
          {quotes.length > 0 && (
            <ul className="flex flex-col divide-y divide-border-subtle">
              {quotes.map((quote) => (
                <li key={`${quote.changeId}-${quote.itemId}`} className="flex flex-col gap-1 py-2.5 first:pt-0 last:pb-0">
                  <span className="flex flex-wrap items-center gap-x-2.5 text-sm text-text-muted">
                    <span className="font-mono">{quote.changeId}</span>
                    <span className="font-mono break-all">{quote.location}</span>
                  </span>
                  <code className="font-mono text-sm break-words text-text-secondary">{quote.quote}</code>
                  <span className="text-text-secondary">{quote.reason}</span>
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
              <li key={`${claim.changeId}-${claim.claimId}`} className="flex flex-col gap-1 py-2.5 first:pt-0 last:pb-0">
                <span className="text-text-secondary">&ldquo;{claim.claimText}&rdquo;</span>
                <span className="text-sm text-text-muted">
                  <span className="font-mono">{claim.changeId}</span> · {claim.reason}
                </span>
              </li>
            ))}
          </ul>
        )}
      </ListCard>
    </div>
  );
}

function Scope({ children }: { children: ReactNode }) {
  return <p className="mb-2 text-xs text-text-muted">{children}</p>;
}

function ListCard({
  title,
  count,
  idea = false,
  defaultOpen = false,
  children,
}: {
  title: string;
  count: number;
  /** Shows the "Idea 4 · Quote check" label beside the heading. */
  idea?: boolean;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="relative rounded-page border border-border-subtle bg-surface-panel p-3 pb-4">
      <Disclosure
        defaultOpen={defaultOpen}
        title={
          <span className="flex items-center gap-2">
            <span className="font-semibold text-text-primary">{title}</span>
            <span className="rounded-chip bg-surface-control px-1.5 text-xs text-text-secondary">{count}</span>
          </span>
        }
      >
        <div className="px-1 pt-2">{children}</div>
      </Disclosure>
      {idea && <IdeaLabel n={4} className="absolute top-3.5 right-3" />}
    </section>
  );
}
