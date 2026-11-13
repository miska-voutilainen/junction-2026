/**
 * Trust ladder thresholds: an area earns less review only by catching planted
 * bugs the team knows about (calibration), then by clean human spot checks.
 * Spec section 5, Ladder.
 */

/** What an area must show before the AI's output routes anything there. */
export interface LadderPolicy {
  /** Planted bugs needed before a catch rate means anything: with fewer, the area stays Shadow. */
  minPlanted: number;
  /** Share of planted bugs the AI must catch to leave Shadow. */
  minCatchRate: number;
  /** Clean human spot checks needed on top of calibration to reach Trusted. */
  spotChecksForTrusted: number;
}

/** The ladder policy. */
export const ladderPolicy: LadderPolicy = {
  minPlanted: 3,
  minCatchRate: 0.6,
  spotChecksForTrusted: 5,
};
