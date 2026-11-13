"use client";

import { useEffect } from "react";
import { isTypingTarget } from "@/lib/useShortcuts";

const ROW_LINK = "a[data-inbox-row-link]";

/**
 * `j` and `k` move focus to the next and previous change in the list; Enter
 * then follows the focused link as it would anywhere. Rows hidden by the
 * responsive layout (the table on a phone, the mobile list on a desktop) are
 * skipped. Ignores key presses in text fields and with modifier keys held.
 */
export function useRowNavigation(): void {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) return;
      const step = event.key === "j" ? 1 : event.key === "k" ? -1 : 0;
      if (step === 0) return;

      const links = [...document.querySelectorAll<HTMLAnchorElement>(ROW_LINK)].filter((link) => link.offsetParent !== null);
      if (links.length === 0) return;
      event.preventDefault();
      const current = links.indexOf(document.activeElement as HTMLAnchorElement);
      // With nothing focused yet, j lands on the first row and k on the last.
      const next = current === -1 ? (step === 1 ? 0 : links.length - 1) : Math.min(links.length - 1, Math.max(0, current + step));
      links[next].focus();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
