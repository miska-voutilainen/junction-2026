import type { Coverage } from "@/contracts";
import { cn } from "@/lib/utils";

const CELL: Record<Coverage, string> = {
  read: "bg-coverage-read",
  supported: "border border-dashed border-coverage-supported",
  verified: "bg-coverage-verified opacity-50",
  generated: "border border-coverage-generated bg-coverage-generated/30",
};

// Generated hunks need no reading, and a change can carry hundreds of them (mp-2297: 21 to
// read, then 402 generated). One cell each turns the row into a wall of dots that drowns the
// amber cells the strip exists to show, so a run of this many or more becomes one block.
const MIN_GENERATED_RUN_TO_COLLAPSE = 4;

type Segment = { coverage: Coverage; isCollapsedRun: boolean };

/**
 * One cell per hunk in diff order: amber for "Read this", a dashed outline for
 * Supported, a dim fill for Verified, a faint fill with an outline for Generated.
 * A long run of generated hunks is one wider block. The row's text already says
 * the numbers, so the strip is for the eye and hidden from assistive tech.
 */
export function CoverageStrip({
  coverage,
  className,
}: Readonly<{ coverage: Coverage[]; className?: string }>) {
  return (
    <span aria-hidden="true" className={cn("flex flex-wrap gap-0.5", className)}>
      {toSegments(coverage).map((segment, index) => (
        <span
          key={index}
          className={cn(
            "h-2 rounded-chip",
            segment.isCollapsedRun ? "w-6" : "w-1.5",
            CELL[segment.coverage],
          )}
        />
      ))}
    </span>
  );
}

/** Example: 2 read then 402 generated → [read, read, generated block]; 2 generated stay 2 cells. */
function toSegments(coverage: readonly Coverage[]): Segment[] {
  const segments: Segment[] = [];
  let index = 0;
  while (index < coverage.length) {
    const state = coverage[index];
    let runEnd = index;
    while (runEnd < coverage.length && coverage[runEnd] === state) runEnd++;
    const runLength = runEnd - index;
    if (state === "generated" && runLength >= MIN_GENERATED_RUN_TO_COLLAPSE) {
      segments.push({ coverage: state, isCollapsedRun: true });
    } else {
      for (let cell = 0; cell < runLength; cell++)
        segments.push({ coverage: state, isCollapsedRun: false });
    }
    index = runEnd;
  }
  return segments;
}
