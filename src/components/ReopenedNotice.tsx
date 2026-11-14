import { TriangleAlert } from "lucide-react";
import { areaLabel } from "@/contracts";
import type { Area } from "@/contracts";
import { countOf } from "@/lib/countOf";

/** "Generator", "Generator and Analyzer", "Generator, Analyzer and Security". */
function areaList(areas: Area[]): string {
  const names = areas.map((area) => areaLabel[area]);
  return names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** The copy of the reopened state: which areas' escapes did it and how many hunks need a person now. */
export function reopenedText(areas: Area[], hunkCount: number): string {
  const verb = hunkCount === 1 ? "needs" : "need";
  return `An escape in ${areaList(areas)} re-routed this change after it was signed: ${countOf(hunkCount, "hunk")} the signer didn't read now ${verb} a person.`;
}

/**
 * The line on S2 and S4 that connects the trust ladder to the receipt: the
 * signature still holds, but an escape sent hunks to a person that the signer
 * was told a check covered. Spec section 3, "Reopened by an escape".
 */
export function ReopenedNotice({ areas, hunkCount }: Readonly<{ areas: Area[]; hunkCount: number }>) {
  return (
    <p role="status" className="flex items-start gap-2 text-base text-amber-light">
      <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      {reopenedText(areas, hunkCount)}
    </p>
  );
}
