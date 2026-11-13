/**
 * Motion presets for the `motion` package. One place for the app's timings so
 * entrances feel the same everywhere: ease-out, 200 ms in, exits at 0.8x.
 * Reduced motion is not handled here: `MotionProvider` wraps the app in
 * `MotionConfig reducedMotion="user"`, which turns these transforms off.
 */
import type { TargetAndTransition, Transition } from "motion/react";

export const EASE_OUT = [0.2, 0.8, 0.2, 1] as const;
const ENTER_SECONDS = 0.2;
const EXIT_SECONDS = 0.16;
const POPOVER_ENTER_SECONDS = 0.18;
const POPOVER_EXIT_SECONDS = 0.144;
const CROSSFADE_SECONDS = 0.15;
const STAGGER_SECONDS = 0.03;
// Past ten rows the delay stops growing, so a long list never feels slow.
const STAGGER_CAP = 10;

interface Preset {
  initial: TargetAndTransition;
  animate: TargetAndTransition;
  exit: TargetAndTransition;
}

/** A list row or card entering: fades in while rising 4 px. */
export const fadeUpItem: Preset = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0, transition: { duration: ENTER_SECONDS, ease: EASE_OUT } },
  exit: { opacity: 0, y: 4, transition: { duration: EXIT_SECONDS, ease: EASE_OUT } },
};

/**
 * Delay for the row at `index`, so rows enter one after another.
 *
 * @example staggerChildren(2) // { delay: 0.06 }
 */
export function staggerChildren(index: number): Transition {
  return { delay: Math.min(index, STAGGER_CAP) * STAGGER_SECONDS };
}

/** A popover or menu opening: scales up from 95% while fading in. */
export const popover: Preset = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1, transition: { duration: POPOVER_ENTER_SECONDS, ease: EASE_OUT } },
  exit: { opacity: 0, scale: 0.95, transition: { duration: POPOVER_EXIT_SECONDS, ease: EASE_OUT } },
};

/** Swapping one icon or label for another: opacity plus a 2 px blur hides the cut. */
export const crossfade: Preset = {
  initial: { opacity: 0, filter: "blur(2px)" },
  animate: { opacity: 1, filter: "blur(0px)", transition: { duration: CROSSFADE_SECONDS, ease: EASE_OUT } },
  exit: { opacity: 0, filter: "blur(2px)", transition: { duration: CROSSFADE_SECONDS, ease: EASE_OUT } },
};

/** Pressing a button: shrinks to 97% while held. */
export const press = { whileTap: { scale: 0.97 } } as const;
