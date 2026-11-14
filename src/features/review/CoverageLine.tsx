"use client";

import { useState, useSyncExternalStore } from "react";
import { Disclosure } from "@/components/Disclosure";
import { IdeaLabel } from "@/components/IdeaLabel";
import { TierBadge } from "@/components/TierBadge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { tierLabel } from "@/contracts";
import type { TierDecision } from "@/contracts";
import { routingPolicy } from "@/policy/routing";
import { coverageLineText } from "./reviewModel";

/** Width from which the reasons start open: the tablet and desktop layouts, as `compact` in `globals.css`. */
const WIDE_QUERY = "(min-width: 760px)";

const HOW_IS_THIS_COMPUTED = `Tier = the highest tier any rule asks for. Reading time assumes ${routingPolicy.linesPerMinute} changed lines a minute, a stated assumption.`;

/** Fewer reasons than this show as plain lines; more go behind a "Why <Tier>" disclosure. */
const MAX_PLAIN_REASONS = 2;

/**
 * The tier and what it asks of the reader, with the reasons behind it:
 * "Focused  read 2 of 8 hunks · ~1 min (full read ~3 min)", then one line
 * per rule that fired, each with its rule id. The numbers are the hunk
 * coverage map (idea 3): they come from `route()`, so every one of them can
 * be traced to a rule. Spec section 3, S2 tier banner.
 */
export function CoverageLine({ decision }: { decision: TierDecision }) {
  return (
    <section aria-label="Review tier" className="flex flex-col gap-2">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-md">
        <TierBadge tier={decision.tier} className="text-md" />
        <span className="font-medium text-text-primary">{coverageLineText(decision)}</span>
        <IdeaLabel n={3} />
        <HowIsThisComputed />
      </p>
      <Reasons decision={decision} />
    </section>
  );
}

function Reasons({ decision }: { decision: TierDecision }) {
  const isWide = useSyncExternalStore(subscribeToWidth, () => window.matchMedia(WIDE_QUERY).matches, () => false);
  const [chosenIsOpen, setChosenIsOpen] = useState<boolean | null>(null);
  const list = (
    <ul className="flex flex-col gap-1">
      {decision.reasons.map((reason, index) => (
        <li key={index} className="text-base text-text-secondary">
          {reason.text} <span className="font-mono text-xs text-text-muted">{reason.ruleId}</span>
        </li>
      ))}
    </ul>
  );
  if (decision.reasons.length <= MAX_PLAIN_REASONS) return list;
  return (
    <Disclosure title={`Why ${tierLabel[decision.tier]}`} isOpen={chosenIsOpen ?? isWide} onOpenChange={setChosenIsOpen}>
      <div className="pl-7">{list}</div>
    </Disclosure>
  );
}

function subscribeToWidth(onChange: () => void): () => void {
  const query = window.matchMedia(WIDE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** The "How is this computed?" tooltip. Controlled, so a tap opens it on a touch screen where hover doesn't exist. */
function HowIsThisComputed() {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <TooltipProvider>
      <Tooltip open={isOpen} onOpenChange={setIsOpen}>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="rounded-chip text-xs text-link underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-focus-ring"
          >
            How is this computed?
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-72 text-sm">{HOW_IS_THIS_COMPUTED}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
