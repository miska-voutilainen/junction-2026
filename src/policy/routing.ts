/**
 * Routing thresholds: the numbers behind "how much of this change must a
 * human read". Kept apart from route() so a reviewer can read and argue with
 * every limit without reading logic. Spec section 5, route().
 */

/** A path glob that always sends a change to a human, with the words shown in the reason. */
export interface SensitivePath {
  glob: string;
  label: string;
}

/** The limits route() applies. */
export interface RoutingPolicy {
  /**
   * Changed lines outside generated files above which the tier is Full: past
   * this, a person skims. 400 is a judgement (spec section 5), not something
   * we measured. Higher, big changes get a Focused read they cannot give; lower,
   * ordinary changes read Full and the tier stops telling changes apart.
   */
  sizeLimit: number;
  /**
   * Share of hunks that need reading at or above which the tier is Full: the AI
   * covered too little to save effort. 0.75 is a judgement (spec section 5),
   * not something we measured. Lower, changes where the AI covered over a quarter
   * of the hunks read Full anyway; higher, a change the AI barely covered still
   * gets a Focused read.
   */
  readShareFull: number;
  /** Review pace used for the time estimate; a careful read of code runs near 25 lines a minute. */
  linesPerMinute: number;
  /** Code whose change is a decision for a person whatever the AI found. */
  sensitivePaths: SensitivePath[];
}

/** The routing policy for Tieto's MessagePack-CSharp fork. */
export const routingPolicy: RoutingPolicy = {
  sizeLimit: 400,
  readShareFull: 0.75,
  linesPerMinute: 25,
  sensitivePaths: [
    {
      glob: "src/MessagePack.Annotations/**",
      label: "public attributes (MessagePack.Annotations)",
    },
    { glob: "**/AnalyzerReleases.*.md", label: "diagnostic IDs (analyzer releases)" },
    { glob: "src/MessagePack/**", label: "the runtime serializer" },
  ],
};

/**
 * The routing rules S5 counts by name: route()'s rules plus `R-no-track-record`,
 * which decideChange() adds when no report card is readable. `R-generated` is
 * left out on purpose: its reason text carries the count of generated hunks,
 * so S5 shows that text instead of a name.
 */
export type RoutingRuleId =
  | "R-size"
  | "R-read-share"
  | "R-escape"
  | "R-refusal"
  | "R-legacy"
  | "R-contradiction"
  | "R-defect"
  | "R-sensitive-path"
  | "R-area-level"
  | "R-unread"
  | "R-no-track-record";

// route() reasons carry sentences with the numbers in them ("3 items refused");
// counting by rule id needs one stable name per rule. Typed by RoutingRuleId, so
// an id added to the union without a name here does not compile. The link back
// to route() is not typed: a new rule there needs an entry here, or S5 falls
// back to its reason text.
const ROUTING_RULE_LABEL: Record<RoutingRuleId, string> = {
  "R-size": "Large change outside generated files",
  "R-read-share": "Most hunks need a human",
  "R-escape": "A bug escaped in this area",
  "R-refusal": "Refused item: a human decides",
  "R-legacy": "Touches legacy code",
  "R-contradiction": "Description contradicts the code",
  "R-defect": "Defect found",
  "R-sensitive-path": "Touches a sensitive path",
  "R-area-level": "Area not yet Trusted",
  "R-unread": "Hunks without checked evidence",
  "R-no-track-record": "No readable report card",
};

/** The stable name of a routing rule, or undefined for an id without one (`R-generated`, or a recorded reason from an older rule set). */
export function routingRuleLabel(ruleId: string): string | undefined {
  return ruleId in ROUTING_RULE_LABEL ? ROUTING_RULE_LABEL[ruleId as RoutingRuleId] : undefined;
}
