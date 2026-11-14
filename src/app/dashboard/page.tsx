import { AppShell } from "@/components/AppShell";
import { EscapeCounter } from "@/components/EscapeCounter";
import { DashboardError, DashboardScreen, FALLBACK_REPO, loadDashboardSources } from "@/features/dashboard";

/**
 * S5 · Dashboard. Reads every review, receipt and the report card on the
 * server and hands plain data to `DashboardScreen`, which counts and routes it
 * in the browser. Any file that fails validation shows the error instead of
 * numbers (spec section 3, S5).
 */
export default async function DashboardPage() {
  const loaded = await loadDashboardSources();
  if (loaded.status === "invalid") {
    return (
      <AppShell
        changes={[]}
        repo={FALLBACK_REPO}
        title="Dashboard"
        breadcrumb={[{ label: "Dashboard" }]}
        escapeSlot={<EscapeCounter />}
      >
        <div className="mx-auto w-full max-w-content px-4 py-6 compact:px-8 compact:py-7">
          <DashboardError details={loaded.errors.join("\n")} />
        </div>
      </AppShell>
    );
  }
  return (
    <DashboardScreen
      sources={loaded.sources}
      reportCard={loaded.reportCard}
      repo={loaded.repo}
      usesFixture={loaded.usesFixture}
    />
  );
}
