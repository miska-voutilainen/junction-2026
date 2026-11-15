import { IdeaLabel } from "@/components/IdeaLabel";
import type { ReportCard } from "@/contracts";
import { blindFirstSummary } from "./reportCardModel";

/**
 * Idea 2, measured: does the reviewer catch a false statement in the author's
 * description more often when it reads the code before the description? One row
 * per planted contradiction, with both modes' catches over the same runs.
 */
export function BlindFirstSection({ reportCard }: Readonly<{ reportCard: ReportCard }>) {
  const { overall, rows } = blindFirstSummary(reportCard);
  return (
    <section aria-labelledby="blind-first-heading" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 id="blind-first-heading" className="text-lg font-semibold">
          Given the description first vs blind-first
        </h2>
        <IdeaLabel n={2} />
      </div>
      <p className="text-text-muted">{overall}</p>
      <ul className="flex flex-col divide-y divide-border-subtle overflow-hidden rounded-page border border-border-subtle bg-surface-panel">
        {rows.map((row) => (
          <li
            key={row.plantId}
            className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-4 py-3"
          >
            <span className="min-w-0 flex-1 basis-72 text-text-secondary">
              <span className="mr-2 font-mono text-sm text-text-muted">{row.plantId}</span>
              {row.statement}
            </span>
            <span className="flex gap-4 text-sm text-text-muted">
              <span>
                Described first{" "}
                <b className="font-semibold text-text-primary">{row.describedFirst}</b>
              </span>
              <span>
                Blind-first <b className="font-semibold text-text-primary">{row.blindFirst}</b>
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
