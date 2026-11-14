import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { ErrorState } from "@/components/ErrorState";
import { ReviewScreen } from "@/features/review";
import { highlightHunks } from "@/features/review/highlightHunks";
import { FALLBACK_REPO, loadInboxData } from "@/lib/data/loadInboxSources";
import { loadChange, loadChanges } from "@/lib/data/loaders";

type Params = Promise<{ id: string }>;

// No `dynamicParams = false`: it would answer an unknown id with Next's unstyled 404 instead of this segment's not-found.tsx.

/** One page per Tieto change; planted-bug and contradiction-plant inputs are not reviewed here. */
export async function generateStaticParams(): Promise<{ id: string }[]> {
  const changes = await loadChanges();
  return changes.status === "ok" ? changes.data.map((change) => ({ id: change.id })) : [];
}

/** Tab title "<requirement> · <change title> · Countersign"; plain "Countersign" when the change can't be read. */
export async function generateMetadata({ params }: Readonly<{ params: Params }>): Promise<Metadata> {
  const { id } = await params;
  const change = await loadChange(id);
  if (change.status === "missing") return { title: `No change with id ${id} · Countersign` };
  if (change.status !== "ok") return { title: "Countersign" };
  return { title: `${change.data.requirementId} · ${change.data.title} · Countersign` };
}

/**
 * S2 · Review. Reads every change (the shell lists them all), finds this one
 * and highlights its hunks with shiki, then hands plain data to
 * `ReviewScreen`, which routes it in the browser.
 */
export default async function ReviewPage({ params }: Readonly<{ params: Params }>) {
  const { id } = await params;
  const data = await loadInboxData();
  if (data.status === "invalid") {
    return (
      <AppShell changes={[]} repo={FALLBACK_REPO} title="Review" backHref="/" breadcrumb={[{ label: "Inbox", href: "/" }, { label: id }]}>
        <div className="mx-auto w-full max-w-content px-4 py-6 compact:px-8 compact:py-7">
          <ErrorState title="The changes couldn't be read." body="Nothing was changed. Fix the file named below, then reload." details={data.error} />
        </div>
      </AppShell>
    );
  }
  const current = data.sources.find((source) => source.change.id === id);
  if (!current) notFound();

  const tokens = current.review.state === "ok" ? await highlightHunks(current.review.data.hunks) : {};
  // Validation errors name the file; this change's review file has its id in the path.
  const reviewError = data.problems.find((problem) => problem.includes(id) && problem.includes("review.json")) ?? null;
  return (
    <ReviewScreen
      sources={data.sources}
      currentId={id}
      reportCard={data.reportCard}
      repo={data.repo ?? FALLBACK_REPO}
      usesFixture={data.usesFixture}
      reviewError={reviewError}
      tokens={tokens}
    />
  );
}
