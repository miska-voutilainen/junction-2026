import { coverageLabel } from "@/contracts";
import type { Coverage } from "@/contracts";
import { cn } from "@/lib/utils";

/**
 * Hunk coverage (idea 3): a bar in the gutter and a text label. Only "Read
 * this" is amber and solid; Supported is grey dashed and Verified grey solid,
 * so the eye lands on the hunks that need a person. Spec section 3.
 */
/** The border classes of the coverage bar; the diff gutter draws the same bar on every row. */
export const COVERAGE_BAR: Record<Coverage, string> = {
  read: "border-solid border-coverage-read",
  supported: "border-dashed border-coverage-supported",
  verified: "border-solid border-coverage-verified",
};

/**
 * Gutter bar plus the label for a hunk's coverage state.
 * `isLabelHidden` keeps the label for screen readers only, where the surrounding group already names the state.
 */
export function CoverageMark({
  coverage,
  isLabelHidden = false,
  className,
}: Readonly<{
  coverage: Coverage;
  isLabelHidden?: boolean;
  className?: string;
}>) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-xs text-text-secondary", className)}>
      <span aria-hidden="true" className={cn("h-4 border-l-2", COVERAGE_BAR[coverage])} />
      <span className={isLabelHidden ? "sr-only" : undefined}>{coverageLabel[coverage]}</span>
    </span>
  );
}
