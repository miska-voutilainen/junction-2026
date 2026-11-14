"use client";

import type { Review } from "@/contracts";
import { useSelectedClaim } from "../SelectedClaim";
import { LocationButton } from "./LocationButton";
import { citationLabel } from "./stepsModel";

/**
 * The cited lines of one finding as buttons. Pressing one selects the finding,
 * so the diff highlights all of its lines, and scrolls that citation into view.
 */
export function FindingLocations({
  finding,
  onShowCitation,
}: {
  finding: Review["findings"][number];
  onShowCitation: (citation: Review["findings"][number]["citations"][number]) => void;
}) {
  const { setSelectedFindingId } = useSelectedClaim();
  if (finding.citations.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-0.5">
      {finding.citations.map((citation) => (
        <LocationButton
          key={`${citation.file}:${citation.startLine}:${citation.endLine}`}
          label={citationLabel(citation)}
          onShow={() => {
            setSelectedFindingId(finding.id);
            onShowCitation(citation);
          }}
        />
      ))}
    </div>
  );
}
