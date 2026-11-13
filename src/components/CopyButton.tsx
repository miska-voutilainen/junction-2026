"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Copy } from "lucide-react";
import { crossfade, press } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Long enough to read "Copied", short enough that a second copy is not blocked.
const CONFIRMATION_MS = 1500;

/**
 * An icon button that copies `text` and shows a check for 1.5 s. The button
 * keeps a fixed size so the icon swap never shifts the toolbar, and a polite
 * live region announces the result to screen readers.
 *
 * @param text The raw string to copy, never rendered HTML.
 * @param label The accessible name, e.g. "Copy diff".
 */
export function CopyButton({ text, label, className }: { text: string; label: string; className?: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus("idle"), CONFIRMATION_MS);
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.button
            type="button"
            aria-label={label}
            onClick={copy}
            {...press}
            className={cn(
              "relative inline-flex size-7 items-center justify-center rounded-button text-text-muted transition-colors duration-(--duration-fast) ease-out hover:bg-surface-hover hover:text-text-primary",
              className,
            )}
          >
            <AnimatePresence initial={false} mode="popLayout">
              <motion.span key={status === "copied" ? "copied" : "copy"} {...crossfade} className="flex">
                {status === "copied" ? (
                  <Check aria-hidden="true" className="size-4 text-text-primary" />
                ) : (
                  <Copy aria-hidden="true" className="size-4" />
                )}
              </motion.span>
            </AnimatePresence>
          </motion.button>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
      <span role="status" aria-live="polite" className="sr-only">
        {status === "copied" && "Copied"}
        {status === "failed" && "Copy failed"}
      </span>
    </TooltipProvider>
  );
}
