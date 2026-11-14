"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { AppNav } from "@/components/AppNav";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/**
 * The navigation below 900 px, where the side column is gone: a menu button
 * that opens the same grouped nav in a sheet from the left. The sheet traps
 * focus, closes on Esc, on the backdrop and when a link is followed, and gives
 * focus back to the button. Rendered by both headers; only one is visible.
 *
 * @param needsReviewCount The badge on Inbox in the sheet.
 * @param className Placement in the header; the button itself is a 44 px touch target.
 */
export function NavSheet({ needsReviewCount, className }: { needsReviewCount: number; className?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Open navigation"
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-control text-text-secondary hover:bg-surface-hover hover:text-text-primary",
            className,
          )}
        >
          <Menu aria-hidden="true" className="size-4.5" />
        </button>
      </SheetTrigger>
      <SheetContent side="left" showCloseButton={false} className="w-nav gap-0 bg-surface-raised p-0 sm:max-w-nav">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <SheetDescription className="sr-only">Pages and keyboard shortcuts.</SheetDescription>
        <AppNav needsReviewCount={needsReviewCount} onNavigate={() => setIsOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
