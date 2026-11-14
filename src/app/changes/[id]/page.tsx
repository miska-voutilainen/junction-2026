import { notFound } from "next/navigation";
import { ReviewScreen } from "@/features/review";
import { highlightHunks } from "@/features/review/highlightHunks";
import { loadChanges } from "@/lib/data/loaders";
import { loadInboxSources } from "@/features/inbox/loadInboxSources";

type Params = Promise<{ id: string }>;

/** One page per Tieto change; planted-bug and contradiction-plant inputs are not reviewed here. */
export async function generateStaticParams(): Promise<{ id: string }[]> {
  const changes = await loadChanges();
  return changes.status === "ok" ? changes.data.map((change) => ({ id: change.id })) : [];
}

/**
 * S2 · Review. Reads every change (the shell lists them all), finds this one
 * and highlights its hunks with shiki at build time, then hands plain data to
 * `ReviewScreen`, which routes it in the browser.
 */
export default async function ReviewPage({ params }: { params: Params }) {
  const { id } = await params;
  const inbox = await loadInboxSources();
  if (inbox.status === "invalid") throw new Error(inbox.error);
  const current = inbox.sources.find((source) => source.change.id === id);
  if (!current) notFound();

  const tokens = current.review.state === "ok" ? await highlightHunks(current.review.data.hunks) : {};
  return (
    <ReviewScreen
      sources={inbox.sources}
      currentId={id}
      reportCard={inbox.reportCard}
      repo={current.change.repo}
      usesFixture={inbox.usesFixture}
      reviewError={inbox.reviewErrors[id] ?? null}
      tokens={tokens}
    />
  );
}
