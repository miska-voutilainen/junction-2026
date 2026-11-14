"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { IdeaLabel } from "@/components/IdeaLabel";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { LocationButton } from "./LocationButton";
import type { Refusals, RefusalView } from "./stepsModel";

interface RefusedStepProps {
  refusals: Refusals;
  onShowHunk: (hunkId: string) => void;
}

/**
 * Step 3, the refusal policy (idea 5): the decisions the AI will not make,
 * each with the policy rule, the reason, and the named role that decides.
 * A refusal stays open until a valid receipt for this exact diff accepts it.
 * Spec section 3, S2 Refused.
 */
export function RefusedStep({ refusals, onShowHunk }: Readonly<RefusedStepProps>) {
  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold text-text-primary">Refused</h3>
          <IdeaLabel n={5} />
        </div>
        <p className="text-sm text-text-muted">
          {refusals.items.length === 0
            ? "The AI never decides these."
            : `The AI never decides these. Refusal policy ${refusals.policyVersion} has ${refusals.ruleCount} rules. Each stays open on the receipt until its owner decides.`}
        </p>
      </header>
      {refusals.items.length === 0 && (
        <p className="text-sm text-text-secondary">
          Nothing refused. Policy {refusals.policyVersion} has {refusals.ruleCount} rules. None applied to this change.
        </p>
      )}
      <ul className="flex flex-col">
        {refusals.items.map((refusal) => (
          <RefusalItem key={refusal.id} refusal={refusal} onShowHunk={onShowHunk} />
        ))}
      </ul>
    </div>
  );
}

function RefusalItem({ refusal, onShowHunk }: Readonly<{ refusal: RefusalView } & Pick<RefusedStepProps, "onShowHunk">>) {
  return (
    <li className="flex flex-col gap-2 border-t border-border-subtle py-4 first:border-t-0 first:pt-0">
      <p className="flex items-baseline gap-2">
        <span className="shrink-0 rounded-chip border border-border-default px-1.5 font-mono text-xs text-text-secondary">{refusal.ruleId}</span>
        <span data-written-text className="text-base font-medium text-text-primary">{refusal.title}</span>
      </p>
      <RaisedBy source={refusal.source} />
      <p data-written-text className="text-sm text-text-secondary">{refusal.reason}</p>
      {refusal.locations.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
          {refusal.locations.map((location) => (
            <LocationButton key={location.hunkId} label={location.label} onShow={() => onShowHunk(location.hunkId)} />
          ))}
        </div>
      )}
      <p className="text-sm text-text-secondary">
        <span className="text-text-muted">Decides: </span>
        {refusal.decider}
      </p>
      {refusal.acceptedBy !== null ? (
        <p className="flex items-center gap-1.5 text-sm text-text-secondary">
          <Check aria-hidden="true" className="size-4 shrink-0" />
          Accepted in the receipt by {refusal.acceptedBy}
        </p>
      ) : (
        <p className="text-xs text-amber-light">Open: no signed receipt accepts it yet</p>
      )}
    </li>
  );
}

const FIXED_RULE_NOTE = "A fixed policy rule raised this, no model involved. It always reaches a person, whatever the model says.";

/**
 * Who raised the refusal: a small neutral chip. "Fixed rule" is a code rule
 * that fires without a model, so the reviewer cannot talk its way out of it;
 * "AI" is a refusal the reviewer raised. The chip's tooltip and its screen
 * reader description carry the explanation (idea 8). The tooltip is controlled
 * so a tap opens it on a touch screen, where hover and focus never fire.
 */
function RaisedBy({ source }: Readonly<{ source: RefusalView["source"] }>) {
  const chip = "w-fit rounded-chip border border-border-default px-1.5 text-xs text-text-muted";
  const [isOpen, setIsOpen] = useState(false);
  if (source === "ai") return <span className={chip}>AI</span>;
  return (
    <TooltipProvider>
      <Tooltip open={isOpen} onOpenChange={setIsOpen}>
        <TooltipTrigger asChild>
          <button type="button" onClick={(event) => {
              // Radix closes the tooltip on press; stopping that default lets the tap open it.
              event.preventDefault();
              setIsOpen(true);
            }} aria-label={`Fixed rule. ${FIXED_RULE_NOTE}`} className={`${chip} focus-visible:outline-2 focus-visible:outline-focus-ring`}>
            Fixed rule
          </button>
        </TooltipTrigger>
        <TooltipContent>{FIXED_RULE_NOTE}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
