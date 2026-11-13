import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Kbd } from "@/components/ui/kbd";
import type { ReviewedRow } from "./inboxModel";

/**
 * Page title, one line of purpose and the primary action: "Review next" opens
 * the first change that still needs a signature. Hidden when none does. On a
 * phone only the title is read (the mobile header already shows it), since the
 * mobile sections lead with what can be signed there.
 *
 * @param reviewNext The change the button opens, or null when nothing needs review.
 */
export function InboxHeader({ reviewNext }: { reviewNext: ReviewedRow | null }) {
  return (
    <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
      <div className="flex min-w-0 flex-1 basis-80 flex-col gap-1.5">
        <h1 className="sr-only text-2xl font-semibold tracking-tight compact:not-sr-only">Inbox</h1>
        <p className="hidden text-text-muted compact:block">Agent changes waiting for a named person to sign.</p>
      </div>
      {reviewNext && (
        <Link
          href={`/changes/${reviewNext.id}`}
          className="hidden items-center gap-2 rounded-button bg-brand py-2.5 pr-3.5 pl-4 text-sm font-semibold text-white transition-colors duration-(--duration-fast) hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring-on-brand compact:inline-flex"
        >
          Review next
          <span className="font-mono text-xs font-medium opacity-85">{reviewNext.id}</span>
          <Kbd className="bg-white/15 text-white">N</Kbd>
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      )}
    </div>
  );
}
