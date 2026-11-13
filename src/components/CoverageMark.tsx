import { coverageLabel } from "@/contracts";
import type { Coverage } from "@/contracts";
import { cn } from "@/lib/utils";

/**
 * Hunk coverage (idea 3): a bar in the gutter and a text label. Only "Read
 * this" is amber and solid; Supported is grey dashed and Verified grey solid,
 * so the eye lands on the hunks that need a person. Spec section 3.
 */
const BARS: Record<Coverage, string> = {
  read: "border-solid border-coverage-read",
  supported: "border-dashed border-coverage-supported",
  verified: "border-solid border-coverage-verified",
};

/** Gutter bar plus the label for a hunk's coverage state. */
export function CoverageMark({ coverage, className }: { coverage: Coverage; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-xs text-text-secondary", className)}>
      <span aria-hidden="true" className={cn("h-4 border-l-2", BARS[coverage])} />
      {coverageLabel[coverage]}
    </span>
  );
}
