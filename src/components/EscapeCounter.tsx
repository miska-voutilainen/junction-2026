"use client";

import { Button } from "@/components/ui/button";
import { useEscapes } from "@/lib/simulation/escapes";

/**
 * "Simulated escapes: 2" with a Reset button, for the top bar's `escapeSlot`.
 * Renders nothing while no escape is recorded, so the bar stays quiet until
 * the demo records one (spec section 3, App shell).
 */
export function EscapeCounter() {
  const { total, reset } = useEscapes();
  if (total === 0) return null;
  return (
    <div className="flex items-center gap-2 text-sm text-rose-light">
      <span>Simulated escapes: {total}</span>
      <Button type="button" variant="ghost" size="sm" onClick={reset}>
        Reset
      </Button>
    </div>
  );
}
