import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { FALLBACK_REPO, loadInboxData } from "@/lib/data/loadInboxSources";

export const metadata: Metadata = { title: "Page not found · Countersign" };

/**
 * The 404 for any address outside the five screens (for example /foo). Unknown
 * change ids get their own page under changes/[id]. The shell's change list is
 * left empty: a stray URL needs a way back, not the nav badge.
 */
export default async function NotFound() {
  const data = await loadInboxData();
  const repo = data.status === "ok" ? (data.repo ?? FALLBACK_REPO) : FALLBACK_REPO;
  return (
    <AppShell changes={[]} repo={repo} title="Not Found" backHref="/" breadcrumb={[{ label: "Inbox", href: "/" }, { label: "Not found" }]}>
      <div className="mx-auto w-full max-w-content px-4 py-6 compact:px-8 compact:py-7">
        <EmptyState
          title="No page at this address."
          body="The link may be mistyped or out of date."
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
