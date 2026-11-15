"use client";

import { usePathname } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { BackAction } from "@/components/BackAction";
import { EmptyState } from "@/components/EmptyState";
import { EscapeCounter } from "@/components/EscapeCounter";
import { useShellChanges } from "@/components/useShellChanges";
import type { InboxSource } from "@/features/inbox";
import type { ReportCardInput } from "@/lib/decideChange";

/**
 * The page for an id that is not one of the Tieto changes. A not-found file
 * receives no params, so the id comes from the URL's last segment.
 */
export function ReviewNotFound({
  sources,
  reportCard,
  repo,
}: Readonly<{ sources: InboxSource[]; reportCard: ReportCardInput; repo: string }>) {
  const id = idFromPath(usePathname());
  const changes = useShellChanges(sources, reportCard);

  return (
    <AppShell
      changes={changes}
      repo={repo}
      title="Page not found"
      backHref="/"
      breadcrumb={[{ label: "Inbox", href: "/" }, { label: id }]}
      escapeSlot={<EscapeCounter />}
    >
      <div className="mx-auto w-full max-w-content px-4 py-6 compact:px-8 compact:py-7">
        <EmptyState
          title={`No change with id ${id}.`}
          body="The id may be mistyped, or that change isn't in this repository's inbox."
          actions={<BackAction href="/">Back to the inbox</BackAction>}
        />
      </div>
    </AppShell>
  );
}

/** The id in `/changes/<id>` or `/changes/<id>/receipt`; a malformed escape such as `%E0` is shown as typed instead of throwing. */
function idFromPath(pathname: string): string {
  // /changes/<id> and /changes/<id>/receipt both name the id right after "changes".
  const segments = pathname.split("/").filter(Boolean);
  const segment = segments[segments.indexOf("changes") + 1] ?? "";
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}
