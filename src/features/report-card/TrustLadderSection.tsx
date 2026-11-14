"use client";

import { IdeaLabel } from "@/components/IdeaLabel";
import type { Area } from "@/contracts";
import { AreaCard } from "./AreaCard";
import type { AreaCardModel } from "./reportCardModel";

/**
 * "Trust ladder by area": the four cards, two columns from 1100 px and one
 * below. Recording or undoing an escape changes the shared escape store, which
 * re-levels every card and re-routes the inbox.
 */
export function TrustLadderSection({
  cards,
  record,
  undo,
}: Readonly<{
  cards: AreaCardModel[];
  record: (area: Area) => void;
  undo: (area: Area) => void;
}>) {
  return (
    <section aria-labelledby="trust-ladder-heading" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 id="trust-ladder-heading" className="text-lg font-semibold">
          Trust ladder by area
        </h2>
        <IdeaLabel n={1} />
      </div>
      <div className="grid grid-cols-1 gap-4 wide:grid-cols-2">
        {cards.map((card) => (
          <AreaCard key={card.area} card={card} onRecord={record} onUndo={undo} />
        ))}
      </div>
    </section>
  );
}
