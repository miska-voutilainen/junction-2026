"use client";

import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { WrapText } from "lucide-react";
import { CopyButton } from "@/components/CopyButton";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useWrapPreference } from "@/lib/useWrapPreference";
import type { ConsoleKind } from "@/lib/useWrapPreference";
import { cn } from "@/lib/utils";

interface ConsoleProps {
  /** Names the box for screen readers and the toolbar, e.g. "Diff of Generator.cs". */
  label: string;
  /** The raw text Copy puts on the clipboard, never the rendered HTML. */
  text: string;
  /** Which Wrap choice this console shares with others of its kind. */
  kind: ConsoleKind;
  defaultWrap?: boolean;
  /** Replaces the label text on the toolbar's left, e.g. a hunk's file and header; `label` still names the box. */
  heading?: ReactNode;
  /** Extra controls on the toolbar, left of Wrap and Copy. */
  actions?: ReactNode;
  /** Drops the content padding so a table can run edge to edge. */
  isFlush?: boolean;
  /** Rendered content such as highlighted code; `text` in a <pre> when absent. */
  children?: ReactNode;
  className?: string;
}

/**
 * A box for code or command output with a Wrap and Copy toolbar. Long lines
 * scroll sideways inside the box only, or wrap when the visitor chooses; the
 * choice is remembered per `kind`. The scroll region takes focus when it
 * scrolls, so arrow keys work without a mouse. UI plan section 6.
 */
export function Console({
  label,
  text,
  kind,
  defaultWrap = false,
  heading,
  actions,
  isFlush = false,
  children,
  className,
}: Readonly<ConsoleProps>) {
  const [isWrapped, setIsWrapped] = useWrapPreference(kind, defaultWrap);

  return (
    <div
      data-console
      className={cn(
        "min-w-0 rounded-control border border-border-subtle bg-surface-code",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border-subtle py-1 pr-1.5 pl-3">
        {heading ?? <span className="truncate text-xs text-text-muted">{label}</span>}
        <div className="flex shrink-0 items-center gap-0.5 print:hidden">
          {actions}
          <WrapButton isWrapped={isWrapped} onToggle={() => setIsWrapped(!isWrapped)} />
          <CopyButton text={text} label={`Copy ${label}`} />
        </div>
      </div>
      <div
        {...(isWrapped ? {} : { role: "region", "aria-label": label, tabIndex: 0 })}
        className={cn(
          "rounded-b-control font-mono text-sm text-text-secondary",
          !isFlush && "p-3",
          isWrapped
            ? "[overflow-wrap:anywhere] whitespace-pre-wrap [&_pre]:whitespace-pre-wrap"
            : "overflow-x-auto whitespace-pre print:overflow-visible print:[overflow-wrap:anywhere] print:whitespace-pre-wrap",
        )}
      >
        {children ?? <pre className="font-[inherit]">{text}</pre>}
      </div>
    </div>
  );
}

function WrapButton({
  isWrapped,
  onToggle,
}: Readonly<{ isWrapped: boolean; onToggle: () => void }>) {
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Radix opens a tooltip on any focus, including the focus a dialog gives its first control
  // when it opens; that tooltip then swallows the first Escape. Open it only for a pointer
  // hover or keyboard focus, which `:hover` and `:focus-visible` tell apart from script focus.
  function onTooltipOpenChange(next: boolean) {
    const button = buttonRef.current;
    setIsTooltipOpen(
      !next || (button !== null && (button.matches(":hover") || button.matches(":focus-visible"))),
    );
  }

  return (
    <TooltipProvider>
      <Tooltip open={isTooltipOpen} onOpenChange={onTooltipOpenChange}>
        <TooltipTrigger asChild>
          <Button
            ref={buttonRef}
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Wrap lines"
            aria-pressed={isWrapped}
            onClick={onToggle}
            className="text-text-muted hover:bg-surface-hover hover:text-text-primary aria-pressed:bg-surface-hover aria-pressed:text-text-primary"
          >
            <WrapText aria-hidden="true" className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{isWrapped ? "Unwrap lines" : "Wrap lines"}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
