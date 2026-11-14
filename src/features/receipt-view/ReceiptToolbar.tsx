"use client";

import { CopyButton } from "@/components/CopyButton";
import { IdeaLabel } from "@/components/IdeaLabel";
import { Button } from "@/components/ui/button";

/**
 * The row above the receipt card: what this page is, the idea it shows, copy
 * buttons for the verify command and this page's link (for whoever should
 * check the receipt), and Print. The row is left out of the printout.
 */
export function ReceiptToolbar({ verifyCommand }: Readonly<{ verifyCommand: string }>) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 print:hidden">
      <span className="text-sm font-medium text-text-muted">Receipt</span>
      <IdeaLabel n={7} />
      <span className="flex-1" />
      <CopyButton variant="text" label="Copy verify command" text={verifyCommand} />
      {/* window.location is read on press: the server render has no URL. */}
      <CopyButton variant="text" label="Copy link" text={() => window.location.href} />
      <Button type="button" variant="secondary" onClick={() => window.print()} className="min-h-8">
        Print
      </Button>
    </div>
  );
}
