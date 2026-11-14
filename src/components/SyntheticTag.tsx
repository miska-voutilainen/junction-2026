import { cn } from "@/lib/utils";

/** The "synthetic PR description" tag: the author's description was written by us as the agent would, not by a real agent. */
export function SyntheticTag({ className }: Readonly<{ className?: string }>) {
  return (
    <span className={cn("rounded-chip border border-border-default px-1.5 text-xs text-text-muted", className)}>
      synthetic PR description
    </span>
  );
}
