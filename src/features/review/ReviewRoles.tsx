import { IdeaLabel } from "@/components/IdeaLabel";
import { countOf } from "@/lib/countOf";
import type { ReviewRole } from "./reviewRolesModel";

/**
 * The reading list by role: which named role reads how many hunks and why
 * (idea 5). Hidden when no hunk needs a person. Spec section 3, S2.
 */
export function ReviewRoles({ roles }: Readonly<{ roles: ReviewRole[] }>) {
  if (roles.length === 0) return null;
  return (
    <section aria-labelledby="review-roles-heading" className="flex flex-col gap-2">
      <h2
        id="review-roles-heading"
        className="flex flex-wrap items-center gap-x-3 text-md font-medium text-text-primary"
      >
        Who reads what
        <IdeaLabel n={5} />
      </h2>
      <ul className="flex flex-col gap-2">
        {roles.map((entry) => (
          <li
            key={entry.role}
            className="flex flex-wrap items-baseline gap-x-2 rounded-control border border-border-subtle bg-surface-panel p-3 text-sm text-text-secondary"
          >
            <span className="font-medium text-text-primary">{entry.role}</span>
            <span>{countOf(entry.hunkIds.length, "hunk")}</span>
            <span className="min-w-0 break-words text-text-muted">
              · {entry.reasons.join(", ")}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
