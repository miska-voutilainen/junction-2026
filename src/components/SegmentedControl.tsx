"use client";

import { useId } from "react";
import { motion } from "motion/react";
import { useEnterTransition } from "@/lib/motion";
import { cn } from "@/lib/utils";

/** One choice in a `SegmentedControl`; `count` is shown in mono after the label. */
export interface Segment<Value extends string> {
  value: Value;
  label: string;
  count?: number;
}

/**
 * Filter pills: a row of toggle buttons where exactly one is selected. The
 * selected background is one shared element that slides between segments
 * (shared `layoutId`), so the eye follows the change.
 *
 * @param label Names the group for screen readers, e.g. "Filter changes by tier".
 */
export function SegmentedControl<Value extends string>({
  label,
  segments,
  value,
  onChange,
  className,
}: Readonly<{
  label: string;
  segments: readonly Segment<Value>[];
  value: Value;
  onChange: (value: Value) => void;
  className?: string;
}>) {
  // Two controls on one page must not share a layoutId, or their highlights would fly between them.
  const highlightId = useId();
  const slide = useEnterTransition();

  return (
    <div
      role="group"
      aria-label={label}
      className={cn("inline-flex gap-0.5 rounded-control border border-border-subtle bg-surface-panel p-0.5", className)}
    >
      {segments.map((segment) => {
        const isSelected = segment.value === value;
        return (
          <button
            key={segment.value}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onChange(segment.value)}
            className={cn(
              "relative rounded-item px-3 py-1 text-sm transition-colors duration-(--duration-fast) ease-out",
              isSelected ? "text-text-primary" : "text-text-muted hover:text-text-secondary",
            )}
          >
            {isSelected && (
              <motion.span
                layoutId={highlightId}
                aria-hidden="true"
                className="absolute inset-0 rounded-item bg-surface-selected"
                transition={slide}
              />
            )}
            <span className="relative">
              {segment.label}
              {segment.count !== undefined && (
                <span className="ml-1.5 font-mono text-xs text-text-muted">{segment.count}</span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
