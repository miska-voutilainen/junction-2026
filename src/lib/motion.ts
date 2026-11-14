/**
 * Motion presets for the `motion` package: one place for the app's timings so
 * entrances feel the same everywhere. The numbers mirror `--duration-base`
 * (200 ms), `--ease-out` and `--stagger` (30 ms) in `styles/tokens.css`; exits
 * run 20% shorter than entrances.
 *
 * Reduced motion: every component reads a preset through `useMotionPreset`
 * (or a timing through `useEnterTransition`), which returns an instant
 * version when the visitor prefers reduced motion: the end state with a
 * zero-length transition, so nothing moves, fades, blurs or clips.
 */
import { useSyncExternalStore } from "react";
import { useReducedMotion } from "motion/react";
import type { TargetAndTransition, Transition } from "motion/react";

/** The curve of `--ease-out` in tokens.css, for motion that CSS cannot drive. */
export const EASE_OUT = [0.2, 0.8, 0.2, 1] as const;
/** `--duration-base` in tokens.css, in seconds. */
export const ENTER_SECONDS = 0.2;
/** An exit takes 80% of the enter time: leaving should feel quicker than arriving. */
export const EXIT_SECONDS = 0.16;
const POPOVER_ENTER_SECONDS = 0.18;
const POPOVER_EXIT_SECONDS = 0.144;
const CROSSFADE_ENTER_SECONDS = 0.15;
const CROSSFADE_EXIT_SECONDS = 0.12;
const STAGGER_SECONDS = 0.03;
// Past ten rows the delay stops growing, so a long list never feels slow.
const STAGGER_CAP = 10;

const INSTANT: Transition = { duration: 0 };

/** The three states a presence animation moves between. */
export interface Preset {
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

/** A popover or menu opening: scales up from 95% while fading in. */
export const popover: Preset = {
  initial: { opacity: 0, scale: 0.95 },
  animate: {
    opacity: 1,
    scale: 1,
    transition: { duration: POPOVER_ENTER_SECONDS, ease: EASE_OUT },
  },
  exit: { opacity: 0, scale: 0.95, transition: { duration: POPOVER_EXIT_SECONDS, ease: EASE_OUT } },
};

/** Swapping one icon or label for another: opacity plus a 2 px blur hides the cut. */
export const crossfade: Preset = {
  initial: { opacity: 0, filter: "blur(2px)" },
  animate: {
    opacity: 1,
    filter: "blur(0px)",
    transition: { duration: CROSSFADE_ENTER_SECONDS, ease: EASE_OUT },
  },
  exit: {
    opacity: 0,
    filter: "blur(2px)",
    transition: { duration: CROSSFADE_EXIT_SECONDS, ease: EASE_OUT },
  },
};

/** Content revealed by a clip-path wipe; it closes at once so no blank gap opens below it. */
export const reveal: Preset = {
  initial: { clipPath: "inset(0 0 100% 0)", opacity: 0 },
  animate: {
    clipPath: "inset(0 0 0% 0)",
    opacity: 1,
    transition: { duration: ENTER_SECONDS, ease: EASE_OUT },
  },
  exit: { transition: INSTANT },
};

/** Pressing a button: shrinks to 97% while held. */
export const press = { whileTap: { scale: 0.97 } } as const;

/**
 * Delay for the row at `index`, so rows enter one after another. Apply it only
 * to presets from `useMotionPreset`; under reduced motion those have zero
 * duration, and callers should skip the delay too.
 *
 * @example staggerDelay(2) // { delay: 0.06 }
 */
export function staggerDelay(index: number): Transition {
  return { delay: Math.min(index, STAGGER_CAP) * STAGGER_SECONDS };
}

/**
 * The preset to spread onto a `motion` element: `preset` itself, or under
 * reduced motion one that shows the end state at once.
 */
export function useMotionPreset(preset: Preset): Preset {
  const isReduced = useReducedMotion();
  if (!isReduced) return preset;
  const endState = { ...preset.animate };
  delete endState.transition;
  return {
    initial: endState,
    animate: { ...endState, transition: INSTANT },
    exit: { transition: INSTANT },
  };
}

const subscribeNever = () => () => {};

/** False on the server and during hydration, true for anything that mounts afterwards. */
function useHasHydrated(): boolean {
  return useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
}

/**
 * A preset for one row of a list: its entrance waits for its turn
 * (`staggerDelay`), or has no delay under reduced motion, where a delayed
 * instant entrance would only hide the row for a moment.
 *
 * Rows present at page load skip the entrance (`initial: false`): the static
 * HTML must show them, and an opacity-0 start would leave them invisible until
 * scripts run. Only rows that mount later (a filter change, a menu opening) fade up.
 */
export function useStaggeredPreset(
  preset: Preset,
  index: number,
): Omit<Preset, "initial"> & { initial: Preset["initial"] | false } {
  const resolved = useMotionPreset(preset);
  const hasHydrated = useHasHydrated();
  const initial = hasHydrated ? resolved.initial : false;
  if (useReducedMotion()) return { ...resolved, initial };
  const transition = { ...resolved.animate.transition, ...staggerDelay(index) };
  return { ...resolved, initial, animate: { ...resolved.animate, transition } };
}

/** The press gesture, or nothing under reduced motion (no scaling). */
export function usePress(): typeof press | Record<string, never> {
  return useReducedMotion() ? {} : press;
}

/** The standard entrance timing, or zero duration under reduced motion (for layout animations). */
export function useEnterTransition(): Transition {
  return useReducedMotion() ? INSTANT : { duration: ENTER_SECONDS, ease: EASE_OUT };
}
