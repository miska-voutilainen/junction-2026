import { ReviewNotFound } from "@/features/review";
import { FALLBACK_REPO, loadInboxData } from "@/lib/data/loadInboxSources";

/** S2 for an unknown change id: "No change with id <id>." inside the shell, with a way back. */
export default async function NotFound() {
  const data = await loadInboxData();
  if (data.status === "invalid") return <ReviewNotFound sources={[]} reportCard={{ state: "missing" }} repo={FALLBACK_REPO} />;
  return <ReviewNotFound sources={data.sources} reportCard={data.reportCard} repo={data.repo ?? FALLBACK_REPO} />;
}
