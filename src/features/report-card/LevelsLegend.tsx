import { Disclosure } from "@/components/Disclosure";
import { ladderPolicy } from "@/policy/ladder";

const LEVELS = [
  { name: "Shadow", text: "Reviews every change, but routes nothing: a person reads every hunk no checked evidence covers." },
  { name: "Calibrated", text: "Can lower a change to Focused at best, never to Light. Reached by catching planted bugs blind." },
  {
    name: "Trusted",
    text: `Can lower a change to Light. Needs ${ladderPolicy.spotChecksForTrusted} clean spot checks; none are recorded in this reference.`,
  },
];

/** "How levels work": the three levels in the policy's own numbers, closed by default. */
export function LevelsLegend() {
  return (
    <Disclosure
      title={
        <span>
          How levels work{" "}
          <span className="text-text-muted">
            · Shadow → Calibrated → Trusted. Up on blind catches, down one level per escape.
          </span>
        </span>
      }
    >
      <dl className="grid grid-cols-1 gap-3 pt-1 min-[900px]:grid-cols-3">
        {LEVELS.map(({ name, text }) => (
          <div key={name} className="rounded-control border border-border-subtle bg-surface-panel p-3.5">
            <dt className="font-semibold">{name}</dt>
            <dd className="mt-1 text-text-muted">{text}</dd>
          </div>
        ))}
      </dl>
    </Disclosure>
  );
}
