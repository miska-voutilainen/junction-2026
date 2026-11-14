"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Long enough to read "Copied", short enough that a second copy is not blocked.
const CONFIRMATION_MS = 1500;

/** "idle" until a copy, then "copied" or "failed" for 1.5 s. */
export type CopyStatus = "idle" | "copied" | "failed";

/** What a polite live region says for each status; the one failure message of the app. */
export const COPY_ANNOUNCEMENT: Record<CopyStatus, string> = {
  idle: "",
  copied: "Copied",
  failed: "Couldn't copy. Select the text instead.",
};

/**
 * Clipboard copy with a status that resets itself. `copy(text)` writes to the
 * clipboard; the browser can refuse (no permission, insecure context), which
 * shows as "failed" instead of throwing.
 */
export function useCopy(): { status: CopyStatus; copy: (text: string) => Promise<void> } {
  const [status, setStatus] = useState<CopyStatus>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus("idle"), CONFIRMATION_MS);
  }, []);

  return { status, copy };
}
