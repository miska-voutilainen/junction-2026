"use client";

import { Disclosure } from "@/components/Disclosure";
import { IdeaLabel } from "@/components/IdeaLabel";
import { FindingLocations } from "./FindingLocations";
import type { BlindCheck, FindingView } from "./stepsModel";

/**
 * Step 2, blind-first review (idea 2): what the reviewer expected from the
 * requirement before it read the diff or the author's description, where the
 * description and the code disagree, and how much reading blind helped on
 * the planted contradictions. Spec section 3, S2 Blind check.
 */
export function BlindCheckStep({ blindCheck }: { blindCheck: BlindCheck }) {
  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold text-text-primary">Blind check</h3>
          <IdeaLabel n={2} />
        </div>
        <p className="text-sm text-text-muted">
          The reviewer wrote down what it expected from the requirement before it saw the diff or the author&apos;s description.
        </p>
      </header>
      <Expected requirementId={blindCheck.requirementId} expected={blindCheck.expected} />
      <Contradictions contradictions={blindCheck.contradictions} />
      <ReadingOrder blindCheck={blindCheck} />
      <FindingList
        heading="Missing"
        emptyText="Nothing missing."
        findings={blindCheck.missing}
      />
      <FindingList
        heading="Scope creep"
        emptyText="No scope creep found."
        findings={blindCheck.scopeCreep}
      />
    </div>
  );
}

function Expected({ requirementId, expected }: Pick<BlindCheck, "requirementId" | "expected">) {
  // Anchored runs have no expectation: nothing was written down before the diff.
  if (expected.length === 0) return null;
  return (
    <Disclosure title={`Expected from ${requirementId} before reading the diff`}>
      <ul className="flex flex-col gap-3 pl-1">
        {expected.map((item) => (
          <li key={item.itemId} className="flex flex-col gap-1">
            <span className="font-mono text-xs text-text-muted">{item.itemId}</span>
            <ul className="flex flex-col gap-1">
              {item.behaviours.map((behaviour) => (
                <li key={behaviour} className="text-sm text-text-secondary">
                  {behaviour}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </Disclosure>
  );
}

function Contradictions({ contradictions }: { contradictions: FindingView[] }) {
  return (
    <section aria-labelledby="contradictions-heading" className="flex flex-col gap-3">
      <h4 id="contradictions-heading" className="text-sm font-semibold text-text-primary">
        Contradictions ({contradictions.length})
      </h4>
      {contradictions.length === 0 && <p className="text-sm text-text-secondary">No contradictions between the PR description and the code.</p>}
      <ul className="flex flex-col gap-4">
        {contradictions.map((view) => (
          <li key={view.finding.id} className="flex flex-col gap-2 rounded-item border border-border-default bg-surface-raised p-3">
            <p className="text-base font-medium text-text-primary">{view.finding.title}</p>
            <p className="text-sm text-text-secondary">
              <span className="font-medium text-text-muted">The PR says: </span>
              {view.finding.statement}
            </p>
            <p className="text-sm text-text-secondary">
              <span className="font-medium text-text-muted">The code does: </span>
              {view.finding.detail}
            </p>
            <FindingLocations view={view} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The measured effect of reading blind: this change's planted contradiction, then the count over every plant. */
function ReadingOrder({ blindCheck }: { blindCheck: BlindCheck }) {
  if (blindCheck.overallLine === null) return null;
  return (
    <section aria-labelledby="reading-order-heading" className="flex flex-col gap-2">
      <h4 id="reading-order-heading" className="text-sm font-semibold text-text-primary">
        Given the PR description first vs blind-first
      </h4>
      {blindCheck.readingOrder.map((row) => (
        <div key={row.statement} className="flex flex-col gap-1.5 text-sm text-text-secondary">
          <p>
            <span className="font-medium text-text-muted">Planted statement: </span>
            {row.statement}
          </p>
          <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1">
            <dt>Described first</dt>
            <dd className="tabular-nums">
              caught {row.anchoredCaught} of {row.runs} runs
            </dd>
            <dt>Blind-first</dt>
            <dd className="font-medium tabular-nums text-text-primary">
              caught {row.blindCaught} of {row.runs} runs
            </dd>
          </dl>
        </div>
      ))}
      <p className="text-xs text-text-muted">{blindCheck.overallLine}</p>
    </section>
  );
}

function FindingList({ heading, emptyText, findings }: { heading: string; emptyText: string; findings: FindingView[] }) {
  return (
    <section aria-label={heading} className="flex flex-col gap-2">
      <h4 className="text-sm font-semibold text-text-primary">
        {heading} ({findings.length})
      </h4>
      {findings.length === 0 && <p className="text-sm text-text-secondary">{emptyText}</p>}
      <ul className="flex flex-col gap-3">
        {findings.map((view) => (
          <li key={view.finding.id} className="flex flex-col gap-1">
            <p className="text-base font-medium text-text-primary">{view.finding.title}</p>
            <p className="text-sm text-text-secondary">{view.finding.detail}</p>
            <FindingLocations view={view} />
          </li>
        ))}
      </ul>
    </section>
  );
}
