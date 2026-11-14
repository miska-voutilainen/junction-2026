"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { EscapeCounter } from "@/components/EscapeCounter";
import type { InboxSource, ReportCardInput } from "@/features/inbox/inboxModel";
import { useShellChanges } from "./useShellChanges";

/**
 * The page for an id that is not one of the Tieto changes. A not-found file
 * receives no params, so the id comes from the URL's last segment.
 */
export function ReviewNotFound({ sources, reportCard, repo }: { sources: InboxSource[]; reportCard: ReportCardInput; repo: string }) {
  const id = decodeURIComponent(usePathname().split("/").filter(Boolean).pop() ?? "");
  const changes = useShellChanges(sources, reportCard);

  return (
    <AppShell
      changes={changes}
      repo={repo}
      title="Not found"
      backHref="/"
      breadcrumb={[{ label: "Inbox", href: "/" }, { label: id }]}
      escapeSlot={<EscapeCounter />}
    >
      <div className="mx-auto w-full max-w-content px-4 py-6 compact:px-8 compact:py-7">
        <EmptyState
          title={`No change with id ${id}.`}
          body="The id may be mistyped, or that change isn't in this repository's inbox."
          actions={
            <Link href="/" className="rounded-item text-sm text-link hover:underline focus-visible:outline-2 focus-visible:outline-focus-ring">
              Back to the inbox
            </Link>
          }
        />
      </div>
    </AppShell>
  );
}
