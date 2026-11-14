import type { ReactNode } from "react";
import { AreaChip } from "@/components/AreaChip";
import { Disclosure } from "@/components/Disclosure";
import { IdeaLabel } from "@/components/IdeaLabel";
import type { ReportCard } from "@/contracts";
import { failedQuotes, hallucinationLines, missedPlants, retractedClaims } from "./reportCardModel";
import type { ReviewOfChange } from "./reportCardModel";

/**
 * The three lists under the ladder: planted bugs the reviewer missed, what the
 * quote check caught, and claims it withdrew. Each is a card whose heading
 * opens it; the first starts open. Responsive grid, one column on a phone.
 */
export function ReportLists({ reportCard, reviews }: { reportCard: ReportCard; reviews: ReviewOfChange[] }) {
  const missed = missedPlants(reportCard);
  const quotes = failedQuotes(reviews);
  const retracted = retractedClaims(reviews);

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,22rem),1fr))] items-start gap-4">
      <ListCard title="Missed planted bugs" count={missed.length} defaultOpen>
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

      <ListCard title="Hallucinations caught" count={reportCard.hallucinations.quoteFailures} idea={4}>
        <ul className="flex flex-col gap-1 text-text-secondary">
          {hallucinationLines(reportCard).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        {quotes.length > 0 && (
          <ul className="mt-3 flex flex-col divide-y divide-border-subtle border-t border-border-subtle">
            {quotes.map((quote) => (
              <li key={`${quote.changeId}-${quote.location}`} className="flex flex-col gap-1 py-2.5 last:pb-0">
                <span className="flex flex-wrap items-center gap-x-2.5 text-sm text-text-muted">
                  <span className="font-mono">{quote.changeId}</span>
                  <span className="font-mono break-all">{quote.location}</span>
                </span>
                <span className="text-text-secondary">{quote.reason}</span>
              </li>
            ))}
          </ul>
        )}
      </ListCard>

      <ListCard title="Retracted claims" count={retracted.length}>
        {retracted.length === 0 ? (
          <p className="text-text-muted">No claim was retracted in the recorded reviews.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border-subtle">
            {retracted.map((claim) => (
              <li key={`${claim.changeId}-${claim.claimText}`} className="flex flex-col gap-1 py-2.5 first:pt-0 last:pb-0">
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

function ListCard({
  title,
  count,
  idea,
  defaultOpen = false,
  children,
}: {
  title: string;
  count: number;
  idea?: 4;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="rounded-page border border-border-subtle bg-surface-panel p-3 pb-4">
      {idea && <IdeaLabel n={idea} className="mb-1 ml-1" />}
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
    </section>
  );
}
