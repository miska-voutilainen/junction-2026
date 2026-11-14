import type { Coverage } from "@/contracts";
import { cn } from "@/lib/utils";

const CELL: Record<Coverage, string> = {
  read: "bg-coverage-read",
  supported: "border border-dashed border-coverage-supported",
  verified: "bg-coverage-verified opacity-50",
};

/**
 * One cell per hunk in diff order: amber for "Read this", a dashed outline for
 * Supported, a dim fill for Verified. The row's text already says the numbers,
 * so the strip is for the eye and hidden from assistive tech.
 */
export function CoverageStrip({ coverage, className }: Readonly<{ coverage: Coverage[]; className?: string }>) {
  return (
    <span aria-hidden="true" className={cn("flex flex-wrap gap-0.5", className)}>
      {coverage.map((state, index) => (
        <span key={index} className={cn("h-2 w-1.5 rounded-chip", CELL[state])} />
      ))}
    </span>
  );
}
