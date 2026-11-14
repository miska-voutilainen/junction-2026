"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check, CircleAlert, Copy } from "lucide-react";
import { crossfade, useMotionPreset, usePress } from "@/lib/motion";
import { COPY_ANNOUNCEMENT, useCopy } from "@/lib/useCopy";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * A button that copies `text` and shows a check, or an alert icon when the browser refuses, for 1.5 s. The icon
 * variant keeps a fixed size so the icon swap never shifts the toolbar; the text variant is a labelled button
 * whose icon swaps the same way. A polite live region announces the result to screen readers.
 *
 * @param text The raw string to copy, never rendered HTML; a function is called only when the button is pressed (e.g. to read `window.location`).
 * @param label The accessible name, e.g. "Copy diff"; the visible text of the text variant.
 * @param variant "icon" (default) for a toolbar, "text" for a labelled button.
 * @param describedBy The id of text that explains the button, e.g. why it copies instead of acting; text variant only.
 */
export function CopyButton({
  text,
  label,
  variant = "icon",
  describedBy,
  className,
}: Readonly<{
  text: string | (() => string);
  label: string;
  variant?: "icon" | "text";
  describedBy?: string;
  className?: string;
}>) {
  const { status, copy } = useCopy();
  const copyText = () => copy(typeof text === "function" ? text() : text);
  const iconSwap = useMotionPreset(crossfade);
  const press = usePress();

  const icon = (
    <AnimatePresence initial={false} mode="popLayout">
      <motion.span key={status === "idle" ? "copy" : status} {...iconSwap} className="flex">
        {status === "copied" && <Check aria-hidden="true" className="size-4 text-text-primary" />}
        {status === "failed" && <CircleAlert aria-hidden="true" className="size-4 text-rose" />}
        {status === "idle" && <Copy aria-hidden="true" className="size-4" />}
      </motion.span>
    </AnimatePresence>
  );

  return (
    <TooltipProvider>
      {variant === "text" ? (
        <Button type="button" variant="secondary" onClick={copyText} aria-describedby={describedBy} className={cn("min-h-8", className)}>
          <span className="relative size-4 shrink-0">{icon}</span>
          {label}
        </Button>
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <motion.button
              type="button"
              aria-label={label}
              onClick={copyText}
              {...press}
              className={cn(
                "relative inline-flex size-7 items-center justify-center rounded-button text-text-muted transition-colors duration-(--duration-fast) ease-out hover:bg-surface-hover hover:text-text-primary",
                className,
              )}
            >
              {icon}
            </motion.button>
          </TooltipTrigger>
          <TooltipContent>{label}</TooltipContent>
        </Tooltip>
      )}
      <span role="status" aria-live="polite" className="sr-only">
        {COPY_ANNOUNCEMENT[status]}
      </span>
    </TooltipProvider>
  );
}
