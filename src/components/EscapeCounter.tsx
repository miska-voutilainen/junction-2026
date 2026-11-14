"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ESCAPE_TOAST_ID, useEscapes } from "@/lib/simulation/escapes";

/**
 * "Simulated escapes: 2" with a Reset button, for the top bar's `escapeSlot`.
 * Renders nothing while no escape is recorded, so the bar stays quiet until
 * the demo records one (spec section 3, App shell). Shortened below 760 px, where the mobile header is tight.
 */
export function EscapeCounter() {
  const { total, reset } = useEscapes();
  if (total === 0) return null;

  // The recording toast would otherwise stay up and contradict the cleared screen.
  function clearEscapes() {
    reset();
    toast.dismiss(ESCAPE_TOAST_ID);
    toast("Simulated escapes cleared");
  }

  return (
    <div className="flex items-center gap-2 text-sm text-rose-light">
      <span>
        <span className="compact:hidden">Escapes: {total}</span>
        <span className="hidden compact:inline">Simulated escapes: {total}</span>
      </span>
      <Button type="button" variant="ghost" size="sm" onClick={clearEscapes}>
        Reset
      </Button>
    </div>
  );
}
