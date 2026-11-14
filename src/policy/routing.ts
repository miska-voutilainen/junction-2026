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
