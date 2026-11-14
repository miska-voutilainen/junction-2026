"use client";

import type { ReactNode } from "react";
import { MotionConfig } from "motion/react";

/**
 * Makes every `motion` component follow the visitor's reduced-motion setting:
 * with it on, transforms and layout animations are skipped. Mount once in the
 * root layout.
 */
export function MotionProvider({ children }: Readonly<{ children: ReactNode }>) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
