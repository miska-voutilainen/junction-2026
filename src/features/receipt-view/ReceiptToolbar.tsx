"use client";

import { useEffect, useRef, useState } from "react";
import { IdeaLabel } from "@/components/IdeaLabel";
import { Button } from "@/components/ui/button";

// Long enough to read "Copied", short enough that a second copy is not blocked (as in CopyButton).
const CONFIRMATION_MS = 1500;

/**
 * The row above the receipt card: what this page is, the idea it shows, and
 * two copy buttons: the verify command, and this page's link for whoever
 * should check the receipt.
 */
export function ReceiptToolbar({ verifyCommand }: { verifyCommand: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <span className="text-sm font-medium text-text-muted">Receipt</span>
      <IdeaLabel n={7} />
      <span className="flex-1" />
      <CopyTextButton label="Copy verify command" getText={() => verifyCommand} />
      <CopyTextButton label="Copy link" getText={() => window.location.href} />
    </div>
  );
}

/** A text button that copies what `getText` returns and says "Copied" for a moment; a polite live region announces it. */
function CopyTextButton({ label, getText }: { label: string; getText: () => string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(getText());
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus("idle"), CONFIRMATION_MS);
  }

  return (
    <>
      <Button type="button" variant="secondary" onClick={copy} className="min-h-8">
        {status === "copied" ? "Copied" : status === "failed" ? "Copy failed" : label}
      </Button>
      <span role="status" aria-live="polite" className="sr-only">
        {status === "copied" && "Copied"}
        {status === "failed" && "Copy failed"}
      </span>
    </>
  );
}
