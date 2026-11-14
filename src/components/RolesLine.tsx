import type { ReactNode } from "react";
import { IdeaLabel } from "@/components/IdeaLabel";
import type { SignerState } from "@/lib/data/receiptStatus";
import { cn } from "@/lib/utils";

/**
 * Who did what on a change: "Written by <author agent> · Reviewed by <reviewer
 * version> · Signed by <owner>". The author never checks its own work (idea 8):
 * three different parties. Below 760 px the roles stack one per line with no
 * separators; from 760 px they share a line. Each "role name" pair stays whole
 * unless one alone is wider than the line.
 *
 * The "·" is drawn before each pair, shifted left so it sits in the gap. When a
 * pair wraps to a new line its dot lands left of the container and is clipped
 * there, so no dot dangles at a line end or leads a line. The clip is on the
 * left edge only, so focus rings and long values are never cut.
 *
 * @param reviewerVersion The reviewer's version, e.g. "rv1", in mono as an id; null when no review is readable, which leaves the reviewer out.
 * @param signer Who signed; anything but a verified receipt says so in words instead of naming an owner.
 */
export function RolesLine({
  authorAgent,
  reviewerVersion,
  signer,
  className,
}: {
  authorAgent: string;
  reviewerVersion: string | null;
  signer: SignerState;
  className?: string;
}) {
  return (
    <span className={cn("block [clip-path:inset(-4px_-4px_-4px_0)]", className)}>
      <span className="flex min-w-0 flex-col gap-y-0.5 compact:-ml-4 compact:flex-row compact:flex-wrap compact:items-center compact:gap-y-1">
        <Role>Written by {authorAgent}</Role>
        {reviewerVersion !== null && (
          <>
            <span className="sr-only">, </span>
            <Role>
              Reviewed by <span className="font-mono">{reviewerVersion}</span>
            </Role>
          </>
        )}
        <span className="sr-only">, </span>
        <Role>{signerText(signer)}</Role>
        <span className="compact:pl-4">
          <IdeaLabel n={8} />
        </span>
      </span>
    </span>
  );
}

function signerText(signer: SignerState): ReactNode {
  switch (signer.kind) {
    case "signed":
      return `Signed by ${signer.owner}`;
    case "unsigned":
      return <span className="text-text-muted">Not signed yet</span>;
    case "unreadable":
      return <span className="text-text-muted">Receipt couldn&apos;t be read</span>;
    case "unverified":
      return <span className="text-text-muted">Signature failed verification</span>;
  }
}

/** One "role name" pair; the separator before it is decoration, drawn only when the roles share a line. */
function Role({ children }: { children: ReactNode }) {
  return (
    <span className="relative min-w-0 [overflow-wrap:anywhere] compact:max-w-full compact:pl-4 compact:before:absolute compact:before:left-1.5 compact:before:content-['·']">
      {children}
    </span>
  );
}
