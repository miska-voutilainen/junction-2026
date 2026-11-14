"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

// Long enough to read "Copied", short enough that a second press is not blocked.
const CONFIRMATION_MS = 1500;

/**
 * The primary "Sign" button. The site cannot sign: signing needs the owner's
 * own SSH key, so the button copies the sign command to paste into a terminal.
 * A polite live region announces "Copied" to screen readers.
 */
export function CopySignButton({ command, describedBy }: { command: string; describedBy: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(command);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus("idle"), CONFIRMATION_MS);
  }

  return (
    <>
      <Button type="button" onClick={copy} aria-describedby={describedBy} className="h-9 rounded-button bg-brand px-4 text-sm font-semibold text-primary-foreground hover:bg-brand-hover focus-visible:outline-focus-ring-on-brand">
        {status === "copied" ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        {status === "copied" ? "Copied" : status === "failed" ? "Copy failed" : "Sign"}
      </Button>
      <span role="status" aria-live="polite" className="sr-only">
        {status === "copied" && "Copied"}
        {status === "failed" && "Copy failed"}
      </span>
    </>
  );
}
