/**
 * Server-side reading for the dashboard, on top of the shared inbox loader.
 * The inbox shows an unreadable file as one row's problem; the dashboard adds
 * counts across all files, so a file that fails validation fails the whole
 * page (spec section 3, S5: "never show partial counts as if complete").
 * Server-only: it reads `data/`.
 */
import type { InboxSource, ReportCardInput } from "@/features/inbox";
import { loadInboxData } from "@/lib/data/loadInboxSources";

/** What the dashboard needs, or the validation errors that stop it. */
export type DashboardSources =
  | { status: "ok"; sources: InboxSource[]; reportCard: ReportCardInput; repo: string | null; usesFixture: boolean }
  | { status: "invalid"; errors: string[] };

/**
 * Loads every file the dashboard counts; "invalid" lists each failing file's error, one per entry.
 *
 * @param root data folder to read; defaults to the repository's `data/` (tests pass the fixtures)
 */
export async function loadDashboardSources(root?: string): Promise<DashboardSources> {
  const data = await loadInboxData(root);
  if (data.status === "invalid") return { status: "invalid", errors: [data.error] };
  if (data.problems.length > 0) return { status: "invalid", errors: data.problems };
  const { sources, reportCard, repo, usesFixture } = data;
  return { status: "ok", sources, reportCard, repo, usesFixture };
}
