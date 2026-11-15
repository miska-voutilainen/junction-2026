import type { ReactNode } from "react";
import { evidenceLevelLabel } from "@/contracts";
import type { EvidenceLevel } from "@/contracts";
import { cn } from "@/lib/utils";

/**
 * Evidence levels (idea 6): each level has its own shape, so the level reads
 * without colour. Verified is a filled dot, Supported a ring, Unverified an
 * amber dashed ring, Refused a ring with a slash. Spec section 3.
 */
const MARKS: Record<EvidenceLevel, { colour: string; shape: ReactNode }> = {
  verified: {
    colour: "text-text-primary",
    shape: <circle cx="8" cy="8" r="4.5" fill="currentColor" />,
  },
  supported: {
    colour: "text-text-secondary",
    shape: <circle cx="8" cy="8" r="5.25" fill="none" stroke="currentColor" strokeWidth="1.5" />,
  },
  unverified: {
    colour: "text-amber",
    shape: (
      <circle
        cx="8"
        cy="8"
        r="5.25"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="2.4 2"
      />
    ),
  },
  refused: {
    colour: "text-text-muted",
    shape: (
      <>
        <circle cx="8" cy="8" r="5.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M4.3 11.7 11.7 4.3"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </>
    ),
  },
};

/** The 16 px mark for an evidence level. Decorative: pair it with the text label. */
export function EvidenceMark({
  level,
  className,
}: Readonly<{ level: EvidenceLevel; className?: string }>) {
  const { colour, shape } = MARKS[level];
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      width={16}
      height={16}
      className={cn("shrink-0", colour, className)}
    >
      {shape}
    </svg>
  );
}

/** The mark followed by its text label, so the level is never carried by the shape alone. */
export function EvidenceBadge({
  level,
  className,
}: Readonly<{ level: EvidenceLevel; className?: string }>) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs text-text-secondary", className)}>
      <EvidenceMark level={level} />
      {evidenceLevelLabel[level]}
    </span>
  );
}
