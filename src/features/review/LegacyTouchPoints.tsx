import { IdeaLabel } from "@/components/IdeaLabel";
import type { LegacyTouchRow } from "./legacyTouchModel";

/**
 * Where the change reaches what old systems rely on, who decides, and what
 * guards it (idea 9). Shown only when the review has touch points. The status
 * is a word, so it reads without colour. Spec section 3, S2.
 */
export function LegacyTouchPoints({ rows }: Readonly<{ rows: LegacyTouchRow[] }>) {
  if (rows.length === 0) return null;
  return (
    <section aria-labelledby="legacy-touch-heading" className="flex flex-col gap-2">
      <h2
        id="legacy-touch-heading"
        className="flex flex-wrap items-center gap-x-3 text-md font-medium text-text-primary"
      >
        Legacy touch points
        <IdeaLabel n={9} />
      </h2>
      <ul className="flex flex-col gap-2">
        {rows.map((row) => (
          <li
            key={`${row.kind}:${row.detail}`}
            className="flex flex-col gap-1 rounded-control border border-border-subtle bg-surface-panel p-3 text-sm text-text-secondary"
          >
            <p className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-medium text-text-primary">{row.kind}</span>
              <code className="min-w-0 font-mono text-xs break-words">{row.detail}</code>
              <span className="text-text-muted">
                {row.hunks ? `· ${row.hunks} ` : ""}· {row.owner}
              </span>
            </p>
            <p className="flex flex-wrap items-baseline gap-x-2">
              <span className="rounded-control border border-border-default px-1.5 text-xs font-medium text-text-primary">
                {row.statusLabel}
              </span>
              <span className="min-w-0 break-words">{row.evidence}</span>
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
