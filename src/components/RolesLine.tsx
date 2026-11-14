import type { ReactNode } from "react";
import { IdeaLabel } from "@/components/IdeaLabel";
import { cn } from "@/lib/utils";

/**
 * Who did what on a change: "Written by <author agent> · Reviewed by <reviewer
 * version> · Signed by <owner>". The author never checks its own work (idea 8):
 * three different parties, and this line is the only place the review and
 * receipt pages state who signed. Below 760 px the three roles stack one per
 * line with no separators; from 760 px they share a line, each "role name"
 * pair kept whole. The "·" separators are drawn in front of each pair and the
 * container clips the one that lands at the start of a line, so a separator
 * never dangles at a line end or leads a wrapped line.
 *
 * @param reviewerVersion The reviewer's version, e.g. "rv1", shown in mono as an id.
 * @param owner The GitHub login on the receipt; null or undefined when nobody has signed.
 * @param isReceiptUnreadable The receipt file exists but fails validation: say so instead of "Not signed yet".
 */
export function RolesLine({
  authorAgent,
  reviewerVersion,
  owner,
  isReceiptUnreadable = false,
  className,
}: {
  authorAgent: string;
  reviewerVersion: string;
  owner: string | null | undefined;
  isReceiptUnreadable?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("block overflow-hidden", className)}>
      <span className="flex flex-col gap-y-0.5 compact:-ml-4 compact:flex-row compact:flex-wrap compact:items-center compact:gap-y-1">
        <Role>Written by {authorAgent}</Role>
        <Role>
          Reviewed by <span className="font-mono">{reviewerVersion}</span>
        </Role>
        <Role>{signerText(owner, isReceiptUnreadable)}</Role>
        <span className="compact:pl-4">
          <IdeaLabel n={8} />
        </span>
      </span>
    </span>
  );
}

function signerText(owner: string | null | undefined, isReceiptUnreadable: boolean): ReactNode {
  if (isReceiptUnreadable) return <span className="text-text-muted">Receipt couldn&apos;t be read</span>;
  if (!owner) return <span className="text-text-muted">Not signed yet</span>;
  return `Signed by ${owner}`;
}

/** One "role name" pair; the separator before it is decoration, drawn only when the roles share a line. */
function Role({ children }: { children: ReactNode }) {
  return (
    <span className="relative [overflow-wrap:anywhere] compact:pl-4 compact:whitespace-nowrap compact:before:absolute compact:before:left-1.5 compact:before:content-['·']">
      {children}
    </span>
  );
}
