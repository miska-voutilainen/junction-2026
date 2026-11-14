"use client";

import { useEffect, useId, useRef } from "react";
import { toast } from "sonner";
import { LevelLadder } from "@/components/LevelLadder";
import { Button } from "@/components/ui/button";
import { areaLabel, ladderLevelLabel } from "@/contracts";
import type { Area, LadderLevel } from "@/contracts";
import { cn } from "@/lib/utils";
import type { AreaCardModel } from "./reportCardModel";

const LEVEL_PILL: Record<LadderLevel, string> = {
  shadow: "border-border-default text-text-muted",
  calibrated: "border-link/40 text-link",
  trusted: "border-green/40 text-green-light",
};

/**
 * One area of the trust ladder: its level, the evidence behind it (always with
 * the sample size), what the level allows, what the next rung needs, and the
 * button that records a simulated escape. Spec section 3, S3.
 *
 * After an escape is recorded the Record button disables, so focus moves to
 * Undo rather than falling back to the page.
 *
 * @param onRecord Records one escape in this area; the card toasts the result.
 * @param onUndo Takes the escape back.
 */
export function AreaCard({
  card,
  onRecord,
  onUndo,
}: {
  card: AreaCardModel;
  onRecord: (area: Area) => void;
  onUndo: (area: Area) => void;
}) {
  const { area, level, escapes, escapeDrop } = card;
  const headingId = useId();
  const promptId = useId();
  const name = areaLabel[area];
  const undoButton = useRef<HTMLButtonElement>(null);
  const shouldFocusUndo = useRef(false);

  useEffect(() => {
    if (!shouldFocusUndo.current || !escapeDrop) return;
    shouldFocusUndo.current = false;
    undoButton.current?.focus();
  }, [escapeDrop]);

  function recordEscape() {
    shouldFocusUndo.current = true;
    onRecord(area);
    toast(`Escape recorded in ${name} (simulated). Its changes re-routed.`);
  }

  return (
    <article
      aria-labelledby={headingId}
      className="flex min-w-0 flex-col gap-4 rounded-page border border-border-subtle bg-surface-panel p-5"
    >
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h3 id={headingId} className="text-lg font-semibold">
          {name}
        </h3>
        <span className={cn("rounded-chip border px-1.5 py-0.5 text-xs font-medium", LEVEL_PILL[level])}>
          {ladderLevelLabel[level]}
        </span>
        {escapes > 0 && (
          <span className="text-xs text-rose-light">
            ({escapes === 1 ? "1 simulated escape" : `${escapes} simulated escapes`})
          </span>
        )}
        <LevelLadder level={level} className="ml-auto" />
      </header>

      <p className="rounded-control border border-border-subtle bg-surface-raised px-3 py-2.5 text-md font-medium">
        {card.headline}
      </p>

      <dl className="flex flex-col gap-2.5 text-base">
        <Row term="Effect now" detail={card.effect} />
        <Row term="Next step" detail={card.nextStep} note={card.nextStepNote} />
      </dl>

      {escapeDrop && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-control border border-rose/40 px-3 py-2 text-sm text-rose-light"
        >
          <span>
            Escape recorded (simulated) · dropped from {ladderLevelLabel[escapeDrop.from]} to {ladderLevelLabel[escapeDrop.to]}
          </span>
          <Button ref={undoButton} type="button" variant="ghost" size="sm" onClick={() => onUndo(area)} className="text-rose-light">
            Undo
          </Button>
        </div>
      )}

      <footer className="mt-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border-subtle pt-3">
        <p id={promptId} className="text-sm text-text-muted">
          {card.canRecordEscape
            ? `A bug reached main that ${name}'s review missed?`
            : "Shadow is the lowest level, so there is nothing to drop."}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!card.canRecordEscape}
          aria-describedby={promptId}
          onClick={recordEscape}
          className="border-rose/45 text-rose-light hover:bg-rose/10"
        >
          Record escape
        </Button>
      </footer>
    </article>
  );
}

function Row({ term, detail, note }: { term: string; detail: string; note?: string | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-text-muted">{term}</dt>
      <dd className="text-text-secondary">
        {detail}
        {note && <span className="mt-0.5 block text-sm text-text-muted">{note}</span>}
      </dd>
    </div>
  );
}
