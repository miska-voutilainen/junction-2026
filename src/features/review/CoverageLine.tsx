"use client";

import { useState } from "react";
import { Disclosure } from "@/components/Disclosure";
import { IdeaLabel } from "@/components/IdeaLabel";
import { TierBadge } from "@/components/TierBadge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { tierLabel } from "@/contracts";
import type { TierDecision } from "@/contracts";
import { routingPolicy } from "@/policy/routing";
import { coverageLineText } from "./reviewModel";

const HOW_IS_THIS_COMPUTED = `Tier = the highest tier any rule asks for. Reading time assumes ${routingPolicy.linesPerMinute} changed lines a minute, a stated assumption.`;

/** Up to this many reasons show as plain lines on a phone; more go behind a "Why <Tier>" disclosure. */
const MAX_PLAIN_REASONS = 2;

/**
 * The tier and what it asks of the reader, with the reasons behind it:
 * "Focused  read 2 of 8 hunks · ~1 min (full read ~3 min)", then one line
 * per rule that fired, each with its rule id. The numbers are the hunk
 * coverage map (idea 3): they come from `route()`, so every one of them can
 * be traced to a rule. Spec section 3, S2 tier banner.
 */
export function CoverageLine({ decision }: Readonly<{ decision: TierDecision }>) {
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

/** The rule whose reasons are about the reviewer's track record per area, not about this change. */
const AREA_RULE = "R-area-level";

/**
 * One line per rule that fired, in two groups: what this change contains
 * (size, refusals, defects, sensitive paths) and how far the AI is trusted
 * in each area it touches. The groups answer different questions, so from
 * 1100 px they sit side by side instead of one list cut in half. Rule ids
 * lead each line in their own column, so they line up and never wrap.
 * From 760 px up the reasons are a plain list, so nothing animates after
 * hydration; below that, more than two go behind a "Why <Tier>" disclosure
 * to keep the phone's first screen short.
 */
function Reasons({ decision }: Readonly<{ decision: TierDecision }>) {
  const changeReasons = decision.reasons.filter((reason) => reason.ruleId !== AREA_RULE);
  const areaReasons = decision.reasons.filter((reason) => reason.ruleId === AREA_RULE);
  const hasBothGroups = changeReasons.length > 0 && areaReasons.length > 0;
  const list = hasBothGroups ? (
    <div className="flex flex-col gap-3 wide:grid wide:grid-cols-2 wide:gap-x-8">
      <ReasonGroup label="This change" reasons={changeReasons} />
      <ReasonGroup label="Reviewer trust by area" reasons={areaReasons} />
    </div>
  ) : (
    <ReasonList reasons={decision.reasons} />
  );
  if (decision.reasons.length <= MAX_PLAIN_REASONS) return list;
  return (
    <>
      <div className="hidden compact:block">{list}</div>
      <Disclosure title={`Why ${tierLabel[decision.tier]}`} className="compact:hidden">
        <div className="pl-7">{list}</div>
      </Disclosure>
    </>
  );
}

type Reason = TierDecision["reasons"][number];

/** A labelled group of reasons; the label is a plain caption, not a heading, so the page outline stays the review's own. */
function ReasonGroup({ label, reasons }: Readonly<{ label: string; reasons: Reason[] }>) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <p className="text-xs font-medium text-text-muted">{label}</p>
      <ReasonList reasons={reasons} />
    </div>
  );
}

/**
 * Rule id, then the reason: from 760 px a two-column grid whose first column
 * is as wide as the longest id, so "R-sensitive-path" stays on one line and
 * every reason starts at the same x. On a phone that column would squeeze the
 * text to half the width, so the id follows the reason instead.
 */
function ReasonList({ reasons }: Readonly<{ reasons: Reason[] }>) {
  return (
    <ul className="flex flex-col gap-1 compact:grid compact:grid-cols-[max-content_minmax(0,1fr)] compact:gap-x-3">
      {reasons.map((reason, index) => (
        <li
          key={index}
          className="flex flex-wrap items-baseline gap-x-2 text-sm text-text-secondary compact:col-span-2 compact:grid compact:grid-cols-subgrid compact:gap-x-3"
        >
          <span className="order-last font-mono text-xs whitespace-nowrap text-text-muted compact:order-none">
            {reason.ruleId}
          </span>
          <span className="min-w-0 break-words">{reason.text}</span>
        </li>
      ))}
    </ul>
  );
}

/** The "How is this computed?" tooltip. Controlled, so a tap opens it on a touch screen where hover doesn't exist; Esc or moving away closes it. */
function HowIsThisComputed() {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <TooltipProvider>
      <Tooltip open={isOpen} onOpenChange={setIsOpen}>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="inline-flex items-center rounded-chip text-xs text-link underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-focus-ring max-compact:min-h-11"
          >
            How is this computed?
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" align="center" sideOffset={8} className="max-w-72 text-sm">
          {HOW_IS_THIS_COMPUTED}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
