import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { UnlockForm, readAccessCode, safeNextPath } from "@/features/access-gate";
import { Wordmark } from "@/components/Wordmark";

export const metadata: Metadata = {
  title: "Unlock · Countersign",
  robots: { index: false, follow: false },
};

/** Temporary access gate page; see src/features/access-gate/README.md. */
export default async function UnlockPage({ searchParams }: Readonly<PageProps<"/unlock">>) {
  const { next: nextParam } = await searchParams;
  const next = safeNextPath(typeof nextParam === "string" ? nextParam : null);
  const code = readAccessCode();
  if (code === null) redirect(next);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-gate flex-col items-center px-5 pt-16 pb-8">
      <Wordmark size="lg" />
      <div className="flex w-full flex-1 flex-col justify-center gap-7">
        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-semibold tracking-[-0.015em] text-balance">
            This project is private
          </h1>
          <p className="text-text-muted">Enter the code our team gave you.</p>
        </div>
        <UnlockForm codeLength={code.length} next={next} />
      </div>
    </main>
  );
}
