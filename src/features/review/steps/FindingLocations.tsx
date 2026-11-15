"use client";

import { useSelection } from "../SelectionProvider";
import { LocationButton } from "./LocationButton";
import { citationLabel } from "./storyModel";
import type { FindingView } from "./storyModel";

/**
 * The cited lines of one finding as buttons. Pressing one selects the finding
 * with that citation as the scroll target, so the diff highlights all of its
 * lines and brings that one into view; pressing it again clears the
 * highlight. A citation whose quote the quote check did not find in the code is
 * named but not offered: there is nothing in the diff to show.
 */
export function FindingLocations({ view }: Readonly<{ view: FindingView }>) {
  const { selection, setSelectedFindingId } = useSelection();
  if (view.citations.length === 0) return null;
  const isFocusedOn = (citation: (typeof view.citations)[number]["citation"]) =>
    selection?.kind === "finding" &&
    selection.id === view.finding.id &&
    selection.focus === citation;

  return (
    <div className="flex flex-col gap-0.5">
      {view.citations.map(({ citation, isQuoteFound }) => {
        const key = `${citation.file}:${citation.startLine}:${citation.endLine}`;
        if (!isQuoteFound) {
          return (
            <p key={key} className="font-mono text-xs break-all text-text-muted">
              {citationLabel(citation)}{" "}
              <span className="font-sans">· Quote not found in the code</span>
            </p>
          );
        }
        return (
          <LocationButton
            key={key}
            label={citationLabel(citation)}
            onShow={() =>
              setSelectedFindingId(isFocusedOn(citation) ? null : view.finding.id, citation)
            }
          />
        );
      })}
    </div>
  );
}
