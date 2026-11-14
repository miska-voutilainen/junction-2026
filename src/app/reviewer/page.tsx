import type { Metadata } from "next";
import { existsSync } from "node:fs";
import path from "node:path";
import { AppShell } from "@/components/AppShell";
import { EscapeCounter } from "@/components/EscapeCounter";
import { InboxError } from "@/features/inbox";
import { ReviewerScreen } from "@/features/report-card";
import { FALLBACK_REPO, loadInboxData } from "@/lib/data/loadInboxSources";

export const metadata: Metadata = { title: "Reviewer Report Card · Countersign" };

// The page is static, so this runs at build time: the link appears once the file is committed.
const hasLessonsLog = existsSync(path.join(process.cwd(), "docs", "lessons.md"));

/**
 * S3 · Reviewer Report Card. Reads the report card and every change with its
 * review (for the routing spread and the lists), then hands plain data to
 * `ReviewerScreen`, which re-levels in the browser with the simulated escapes.
 */
export default async function ReviewerPage() {
  const data = await loadInboxData();
  if (data.status === "invalid") {
    return (
      <AppShell
        changes={[]}
        repo={FALLBACK_REPO}
        title="Reviewer Report Card"
        breadcrumb={[{ label: "Inbox", href: "/" }, { label: "Reviewer Report Card" }]}
        backHref="/"
        escapeSlot={<EscapeCounter />}
      >
        <InboxError details={data.error} />
      </AppShell>
    );
  }

  return (
    <ReviewerScreen
      sources={data.sources}
      reportCard={data.reportCard}
      repo={data.repo ?? FALLBACK_REPO}
      usesFixture={data.usesFixture}
      hasLessonsLog={hasLessonsLog}
    />
  );
}
