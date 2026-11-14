"use client";

import { Ban } from "lucide-react";
import { AreaChip } from "@/components/AreaChip";
import { Console } from "@/components/Console";
import { Disclosure } from "@/components/Disclosure";
import { EvidenceBadge } from "@/components/EvidenceMark";
import { IdeaLabel } from "@/components/IdeaLabel";
import type { Review } from "@/contracts";
import { cn } from "@/lib/utils";
import { useSelectedClaim } from "../SelectedClaim";
import { FindingLocations } from "./FindingLocations";
import { LocationButton } from "./LocationButton";
import { OWN_TEST_LABEL, OWN_TEST_NOTE, isOwnTestOnly } from "../reviewModel";
import { citationLabel } from "./stepsModel";
import type { ClaimGroup, Story, StoryClaim } from "./stepsModel";

type Claim = Review["claims"][number];

interface ReadStepProps {
  story: Story;
  /** Opens step 3, for a claim the policy refused to judge. */
  onOpenRefused: () => void;
}

/**
 * Step 1, the requirement-traced story: what the change does and why, then
 * every claim the reviewer made, grouped by the requirement item it serves,
 * each with its evidence level (idea 6). Opening a claim selects it, and the
 * diff highlights the lines it cites. Spec section 3, S2 Story.
 */
export function ReadStep({ story, onOpenRefused }: Readonly<ReadStepProps>) {
  return (
    <div className="flex flex-col gap-5">
      <section aria-label="What and why" className="flex flex-col gap-3">
        <StoryText heading="What" text={story.what} />
        <StoryText heading="Why" text={story.why} />
        <Touches touches={story.touches} />
      </section>
      <section aria-labelledby="claims-heading" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 id="claims-heading" className="text-base font-semibold text-text-primary">
            Claims
          </h3>
          <IdeaLabel n={6} />
        </div>
        {story.quoteCheckLine && <p className="text-xs text-text-muted">{story.quoteCheckLine}</p>}
        {story.groups.map((group) => (
          <ClaimGroupList key={group.heading} group={group} onOpenRefused={onOpenRefused} />
        ))}
      </section>
      <Defects defects={story.defects} />
    </div>
  );
}

function StoryText({ heading, text }: Readonly<{ heading: string; text: string }>) {
  return (
    <div className="flex flex-col gap-0.5">
      <h3 className="text-xs font-medium text-text-muted">{heading}</h3>
      <p data-written-text className="text-base text-text-secondary">{text}</p>
    </div>
  );
}

function Touches({ touches }: Readonly<{ touches: Story["touches"] }>) {
  if (touches.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-xs font-medium text-text-muted">What it touches</h3>
      <ul className="flex flex-col gap-1.5">
        {touches.map((touch) => (
          <li key={`${touch.file}:${touch.symbol}`} className="text-base text-text-secondary">
            <span className="font-mono text-sm break-all text-text-primary">{touch.symbol}</span> <span data-written-text>· {touch.note}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ClaimGroupList({ group, onOpenRefused }: Readonly<{ group: ClaimGroup } & Pick<ReadStepProps, "onOpenRefused">>) {
  return (
    <div className="flex flex-col gap-1.5 border-t border-border-subtle pt-3">
      <h4 className="text-xs font-medium text-text-muted">{group.heading}</h4>
      <ul className="flex flex-col gap-1">
        {group.claims.map((storyClaim) => (
          <ClaimRow key={storyClaim.claim.id} storyClaim={storyClaim} onOpenRefused={onOpenRefused} />
        ))}
      </ul>
    </div>
  );
}

function ClaimRow({ storyClaim, onOpenRefused }: Readonly<{ storyClaim: StoryClaim } & Pick<ReadStepProps, "onOpenRefused">>) {
  const { claim, retraction } = storyClaim;
  const { selectedClaimId, setSelectedClaimId } = useSelectedClaim();
  const isSelected = selectedClaimId === claim.id;
  const detailsId = `claim-details-${claim.id}`;

  return (
    <li className={cn("rounded-item border border-transparent", isSelected && "border-border-default bg-surface-selected")}>
      <button
        type="button"
        aria-expanded={isSelected}
        aria-controls={detailsId}
        onClick={() => setSelectedClaimId(isSelected ? null : claim.id)}
        className="flex w-full flex-col items-start gap-1.5 rounded-item px-2 py-2 text-left transition-colors duration-(--duration-fast) ease-out hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-focus-ring"
      >
        {retraction ? <RetractedBadge /> : <EvidenceBadge level={claim.level} />}
        <span data-written-text className={cn("max-w-full text-sm text-text-primary [overflow-wrap:anywhere]", retraction && "text-text-muted line-through")}>{claim.text}</span>
      </button>
      {retraction && <Retraction retraction={retraction} />}
      <div id={detailsId} hidden={!isSelected} className="px-2 pb-2">
        {isSelected && !retraction && <ClaimEvidence storyClaim={storyClaim} onOpenRefused={onOpenRefused} />}
      </div>
    </li>
  );
}

/** Shown in place of the evidence level: a retracted claim has none, the review withdrew it. */
function RetractedBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-amber-light">
      <Ban aria-hidden="true" className="size-4 shrink-0" />
      Retracted
    </span>
  );
}

/** A retracted claim: why it was withdrawn and the output that withdrew it, in place of the evidence it once claimed. */
function Retraction({ retraction }: Readonly<{ retraction: Review["retractions"][number] }>) {
  return (
    <div className="flex flex-col gap-1.5 px-2 pb-2">
      <p data-written-text className="flex flex-wrap items-center gap-2 text-xs text-amber-light">
        Retracted: {retraction.reason}
        <IdeaLabel n={4} />
      </p>
      <Disclosure title="Output that retracted it">
        <Console label="Retraction output" text={retraction.output} kind="output" />
      </Disclosure>
    </div>
  );
}

function ClaimEvidence({ storyClaim, onOpenRefused }: Readonly<{ storyClaim: StoryClaim } & Pick<ReadStepProps, "onOpenRefused">>) {
  const { claim } = storyClaim;
  return (
    <div className="flex flex-col gap-3 text-sm text-text-secondary">
      <Citations storyClaim={storyClaim} />
      {claim.level === "verified" && <TestEvidence claim={claim} />}
      {claim.level === "supported" && <SupportedBy claim={claim} />}
      {claim.level === "unverified" && <p>No checkable evidence. Needs a human.</p>}
      {claim.level === "refused" && (
        <p>
          A human decides this.{" "}
          <button
            type="button"
            onClick={onOpenRefused}
            className="rounded-chip text-link underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-focus-ring"
          >
            See step 3
          </button>
        </p>
      )}
    </div>
  );
}

function Citations({ storyClaim }: Readonly<{ storyClaim: StoryClaim }>) {
  const { setSelectedClaimId } = useSelectedClaim();
  return (
    <ul className="flex flex-col gap-2">
      {storyClaim.citations.map(({ citation, isQuoteFound }) => (
        <li key={`${citation.file}:${citation.startLine}:${citation.endLine}`} className="flex flex-col gap-1">
          {isQuoteFound ? (
            <>
              <LocationButton label={citationLabel(citation)} onShow={() => setSelectedClaimId(storyClaim.claim.id, citation)} />
              <pre className="rounded-item border border-border-subtle bg-surface-code p-2 font-mono text-xs break-words whitespace-pre-wrap text-text-secondary">
                {citation.quote}
              </pre>
            </>
          ) : (
            // The quote check did not find this quote in the cited lines: it is not evidence, so neither the quote nor a highlight is offered.
            <p className="font-mono text-xs break-all text-text-muted">
              {citationLabel(citation)} <span className="font-sans">· Quote not found in the code</span>
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Verified: the recorded test result on the base commit (it fails) and on the change (it passes), each in its own console. */
function TestEvidence({ claim }: Readonly<{ claim: Claim }>) {
  const tests = claim.evidence.filter((item) => item.kind === "differential-test");
  return (
    <>
      {tests.map((test) => (
        <div key={test.testName ?? test.summary} className="flex flex-col gap-1">
          <p>{test.summary}</p>
          {test.testName && <p className="font-mono text-xs break-all text-text-muted">{test.testName}</p>}
          {test.base && (
            <Disclosure title={`${verbOf(test.base.result)} on the base commit`}>
              <Console label="Test output on the base commit" text={test.base.output} kind="output" />
            </Disclosure>
          )}
          {test.head && (
            <Disclosure title={`${verbOf(test.head.result)} on this change`}>
              <Console label="Test output on this change" text={test.head.output} kind="output" />
            </Disclosure>
          )}
        </div>
      ))}
    </>
  );
}

function verbOf(result: "fail" | "pass" | "error"): string {
  return { fail: "Fails", pass: "Passes", error: "Errors" }[result];
}

/** Supported: a checked quote, or a test the change ships; the evidence says which. */
function SupportedBy({ claim }: Readonly<{ claim: Claim }>) {
  return (
    <>
      {isOwnTestOnly(claim) && <OwnTestNote />}
      <SupportedEvidence claim={claim} />
    </>
  );
}

/** Why a claim backed only by the PR's own test stops at Supported (idea 8). */
function OwnTestNote() {
  return (
    <div className="flex flex-col gap-1">
      <p className="flex flex-wrap items-center gap-2 font-medium text-text-primary">
        {OWN_TEST_LABEL}
        <IdeaLabel n={8} />
      </p>
      <p className="text-xs text-text-muted">{OWN_TEST_NOTE}</p>
    </div>
  );
}

function SupportedEvidence({ claim }: Readonly<{ claim: Claim }>) {
  return (
    <ul className="flex flex-col gap-1">
      {claim.evidence.map((item) => (
        <li key={`${item.kind}:${item.summary}`} className="flex flex-wrap items-center gap-2">
          {item.kind === "quote-check" ? "Quote checked against the code" : item.summary}
          {item.kind === "quote-check" && <IdeaLabel n={4} />}
        </li>
      ))}
    </ul>
  );
}

function Defects({ defects }: Readonly<{ defects: Story["defects"] }>) {
  return (
    <section aria-labelledby="defects-heading" className="flex flex-col gap-2 border-t border-border-subtle pt-4">
      <h3 id="defects-heading" className="text-base font-semibold text-text-primary">
        Defects found ({defects.length})
      </h3>
      {defects.length === 0 && <p className="text-sm text-text-secondary">No defects found in the four area checklists.</p>}
      <ul className="flex flex-col gap-3">
        {defects.map((view) => (
          <li key={view.finding.id} className="flex flex-col gap-1">
            <p className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
              <span className="font-medium text-text-secondary capitalize">{view.finding.severity}</span>
              {view.finding.area && <AreaChip area={view.finding.area} />}
            </p>
            <p data-written-text className="text-base font-medium text-text-primary">{view.finding.title}</p>
            <p className="text-sm text-text-secondary">{view.finding.detail}</p>
            <FindingLocations view={view} />
          </li>
        ))}
      </ul>
    </section>
  );
}
