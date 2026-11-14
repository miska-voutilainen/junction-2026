import { tierLabel } from "@/contracts";
import type { Tier } from "@/contracts";
import { cn } from "@/lib/utils";

/** Signal bars lit per tier: the more a person must read, the more bars. */
export const TIER_BARS: Record<Tier, number> = { light: 1, focused: 2, full: 3 };

const TIER_COLOUR: Record<Tier, string> = {
  light: "text-tier-light",
  focused: "text-tier-focused",
  full: "text-tier-full",
};

const BAR_HEIGHTS = ["h-1.5", "h-2.5", "h-3.5"] as const;

/** Signal bars (1 to 3) and the tier name: "Light", "Focused" or "Full". */
export function TierBadge({ tier, className }: Readonly<{ tier: Tier; className?: string }>) {
  const lit = TIER_BARS[tier];
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 text-xs font-medium", TIER_COLOUR[tier], className)}
    >
      <span aria-hidden="true" className="flex h-3.5 items-end gap-0.5">
        {BAR_HEIGHTS.map((height, index) => (
          <span
            key={height}
            data-testid="tier-bar"
            data-lit={index < lit}
            className={cn("w-0.5 rounded-chip bg-current", height, index >= lit && "opacity-30")}
          />
        ))}
      </span>
      {tierLabel[tier]}
    </span>
  );
}
