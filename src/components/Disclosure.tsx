"use client";

import { useId, useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { crossfade, reveal, useMotionPreset } from "@/lib/motion";

/**
 * A button that shows or hides its content. The content is revealed with a
 * clip-path wipe rather than animating height, so the text below does not
 * jump while it opens, and closes at once. With reduced motion it opens at once too.
 *
 * @param title What the button says; the section's name.
 * @param defaultOpen Start expanded.
 * @param isOpen Makes the disclosure controlled: the parent decides, e.g. to open it before scrolling to something inside.
 * @param onOpenChange Called with the next state when the button is pressed; required with `isOpen`.
 */
export function Disclosure({
  title,
  defaultOpen = false,
  isOpen: controlledIsOpen,
  onOpenChange,
  children,
  className,
}: {
  title: ReactNode;
  defaultOpen?: boolean;
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  children: ReactNode;
  className?: string;
}) {
  const [ownIsOpen, setOwnIsOpen] = useState(defaultOpen);
  const isOpen = controlledIsOpen ?? ownIsOpen;
  const setIsOpen = (next: boolean) => {
    setOwnIsOpen(next);
    onOpenChange?.(next);
  };
  const contentId = useId();
  const iconSwap = useMotionPreset(crossfade);
  const contentReveal = useMotionPreset(reveal);

  return (
    <div className={className}>
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={contentId}
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center gap-2 rounded-item px-1 py-1.5 text-left text-base text-text-secondary transition-colors duration-(--duration-fast) ease-out hover:text-text-primary"
      >
        <span className="relative size-4 shrink-0">
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span key={isOpen ? "open" : "closed"} {...iconSwap} className="absolute inset-0 flex">
              {isOpen ? (
                <ChevronDown aria-hidden="true" className="size-4" />
              ) : (
                <ChevronRight aria-hidden="true" className="size-4" />
              )}
            </motion.span>
          </AnimatePresence>
        </span>
        {title}
      </button>
      <div id={contentId}>
        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.div
              key="content"
              {...contentReveal}
              className="pt-1"
            >
              {children}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
