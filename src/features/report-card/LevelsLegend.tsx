import { Disclosure } from "@/components/Disclosure";
import { ladderPolicy } from "@/policy/ladder";

/**
 * "How levels work": the three levels in the policy's own numbers, closed by default.
 * @param spotChecksClean Clean spot checks recorded across all areas; the Trusted cell says "none" only when it is 0.
 */
export function LevelsLegend({ spotChecksClean }: { spotChecksClean: number }) {
  const recorded = spotChecksClean === 0 ? "none are recorded in this reference" : `${spotChecksClean} recorded so far`;
  const levels = [
    { name: "Shadow", text: "Reviews every change, but routes nothing: a person reads every hunk no checked evidence covers." },
    { name: "Calibrated", text: "Can lower a change to Focused at best, never to Light. Reached by catching planted bugs blind." },
    { name: "Trusted", text: `Can lower a change to Light. Needs ${ladderPolicy.spotChecksForTrusted} clean spot checks, ${recorded}.` },
  ];
  return (
    <Disclosure
      title={
        <span>
          How levels work{" "}
          <span className="text-text-muted">
            · Shadow, then Calibrated, then Trusted. Up on blind catches, down one level per escape.
          </span>
        </span>
      }
    >
      <dl className="grid grid-cols-1 gap-3 pt-1 nav:grid-cols-3">
        {levels.map(({ name, text }) => (
          <div key={name} className="rounded-control border border-border-subtle bg-surface-panel p-3.5">
            <dt className="font-semibold">{name}</dt>
            <dd className="mt-1 text-text-muted">{text}</dd>
          </div>
        ))}
      </dl>
    </Disclosure>
  );
}
