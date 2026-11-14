import { ArrowUpRight } from "lucide-react";
import { IDEAS, ideaUrl, type IdeaNumber } from "@/lib/ideaLinks";
import { cn } from "@/lib/utils";

/**
 * "Idea 3 · Hunk coverage map ↗": marks the part of a screen that shows one of
 * the eight ideas and links to its page in a new tab. The name and page come
 * from `IDEAS`, so a label cannot disagree with the list. Spec section 3.
 */
export function IdeaLabel({ n, className }: { n: IdeaNumber; className?: string }) {
  const url = ideaUrl(n);
  const { name } = IDEAS[n];

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener"
      aria-label={`Idea ${n}: ${name}, opens the idea page`}
      className={cn(
        "inline-flex items-center gap-1 rounded-chip border border-border-default px-1.5 py-0.5 text-xs text-text-muted transition-colors duration-(--duration-fast) ease-out hover:bg-surface-hover hover:text-text-secondary",
        className,
      )}
    >
      Idea {n} · {name}
      <ArrowUpRight aria-hidden="true" className="size-3" />
    </a>
  );
}
