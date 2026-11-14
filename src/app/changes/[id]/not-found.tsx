import { ReviewNotFound } from "@/features/review/ReviewNotFound";
import { loadInboxSources } from "@/features/inbox/loadInboxSources";

const FALLBACK_REPO = "No repository";

/** S2 for an unknown change id: "No change with id <id>." inside the shell, with a way back. */
export default async function NotFound() {
  const inbox = await loadInboxSources();
  if (inbox.status === "invalid") return <ReviewNotFound sources={[]} reportCard={{ state: "missing" }} repo={FALLBACK_REPO} />;
  return <ReviewNotFound sources={inbox.sources} reportCard={inbox.reportCard} repo={inbox.sources[0]?.change.repo ?? FALLBACK_REPO} />;
}
