import { IdeaLabel } from "@/components/IdeaLabel";
import { cn } from "@/lib/utils";

/**
 * Who did what on a change, in one line: "Written by <author agent> ·
 * Reviewed by <reviewer version> · Signed by <owner>", or "Not signed yet"
 * while there is no receipt. The author never checks its own work (idea 8):
 * three different parties, and the line is the only place "Signed by" is
 * stated on the review and receipt pages. Each "role name" pair wraps as a
 * unit, so at 375 px a name is never split from its role.
 *
 * @param reviewerVersion The reviewer's version, e.g. "rv1", shown in mono as an id.
 * @param owner The GitHub login on the receipt; null or undefined when nobody has signed.
 */
export function RolesLine({
  authorAgent,
  reviewerVersion,
  owner,
  className,
}: {
  authorAgent: string;
  reviewerVersion: string;
  owner: string | null | undefined;
  className?: string;
}) {
  return (
    <span className={cn("flex flex-wrap items-center gap-x-2 gap-y-1", className)}>
      <span className="[overflow-wrap:anywhere]">Written by {authorAgent} ·</span>{" "}
      {/* The spaces between the pairs are not drawn in a flex row; they keep the copied and spoken text readable. */}
      <span>
        Reviewed by <span className="font-mono">{reviewerVersion}</span> ·
      </span>{" "}
      {owner ? <span className="[overflow-wrap:anywhere]">Signed by {owner}</span> : <span className="text-text-muted">Not signed yet</span>}
      <IdeaLabel n={8} />
    </span>
  );
}
