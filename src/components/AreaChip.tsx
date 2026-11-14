import { areaLabel } from "@/contracts";
import type { Area } from "@/contracts";
import { cn } from "@/lib/utils";

/** Neutral chip naming the area a change or claim belongs to (generator, analyzer, security, performance). */
export function AreaChip({ area, className }: Readonly<{ area: Area; className?: string }>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-chip border border-border-default px-1.5 py-0.5 text-xs text-text-secondary",
        className,
      )}
    >
      {areaLabel[area]}
    </span>
  );
}
