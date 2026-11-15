import { ladderLevelLabel } from "@/contracts";
import type { LadderLevel } from "@/contracts";
import { cn } from "@/lib/utils";

const STEPS: readonly LadderLevel[] = ["shadow", "calibrated", "trusted"];

/**
 * Trust ladder (idea 1): the three levels an area can hold, with the current
 * one marked. One image to assistive tech, so it reads "Level: Calibrated, step
 * 2 of 3" instead of three loose words.
 */
export function LevelLadder({
  level,
  className,
}: Readonly<{ level: LadderLevel; className?: string }>) {
  const current = STEPS.indexOf(level);
  return (
    <span
      role="img"
      aria-label={`Level: ${ladderLevelLabel[level]}, step ${current + 1} of ${STEPS.length}`}
      className={cn("inline-flex items-center gap-1.5 text-xs", className)}
    >
      {STEPS.map((step, index) => (
        <span key={step} className="inline-flex items-center gap-1.5">
          {index > 0 && <span aria-hidden="true" className="h-px w-3 bg-border-strong" />}
          <span
            aria-hidden="true"
            className={cn(
              "rounded-chip border px-1.5 py-0.5",
              index === current
                ? "border-link bg-surface-selected font-medium text-text-primary"
                : "border-border-default text-text-muted",
            )}
          >
            {ladderLevelLabel[step]}
          </span>
        </span>
      ))}
    </span>
  );
}
