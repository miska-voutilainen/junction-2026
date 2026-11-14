"use client";

import { useSyncExternalStore } from "react";

/**
 * Whether a CSS media query matches, live. On the server and during hydration
 * it returns `serverValue`, so the first render matches the server's HTML and
 * the real answer applies right after.
 *
 * @example useMediaQuery("(min-width: 760px)", true)
 */
export function useMediaQuery(query: string, serverValue: boolean): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}
