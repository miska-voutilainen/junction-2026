import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";

/**
 * The primary action on the inbox and the dashboard: opens the first change
 * that still needs a signature, with its id and, from 760 px, the N shortcut
 * that does the same (a phone has no keyboard).
 *
 * @param changeId The change to open.
 * @param className Layout classes, e.g. to hide it on a phone.
 */
export function ReviewNextLink({ changeId, className }: { changeId: string; className?: string }) {
  return (
    <Link
      href={`/changes/${changeId}`}
      className={cn(
        "inline-flex items-center gap-2 rounded-button bg-brand py-2.5 pr-3.5 pl-4 text-sm font-semibold text-primary-foreground transition-colors duration-(--duration-fast) hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring-on-brand",
        className,
      )}
    >
      Review next
      <span className="font-mono text-xs font-medium opacity-85">{changeId}</span>
      <Kbd className="hidden bg-primary-foreground/15 text-primary-foreground compact:inline-flex">N</Kbd>
      <ArrowRight aria-hidden="true" className="size-4" />
    </Link>
  );
}
