/**
 * Trust ladder thresholds: an area earns less review only by catching planted
 * bugs the team knows about (calibration), then by clean human spot checks.
 * Spec section 5, Ladder.
 */

/**
 * What an area must show before the AI's output routes anything there: the
 * planted-bug record that moves it from Shadow to Calibrated, and the human
 * spot checks that move it on to Trusted. Spec section 5, Ladder.
 */
export interface LadderPolicy {
  /**
   * Planted bugs needed before a catch rate means anything: with fewer, the area
   * stays Shadow. 3 is a judgement (spec section 5): with 1 or 2 a single
   * lucky catch calibrates an area, and every extra plant is work someone must
   * write blind (the sample repository has few per area).
   */
  minPlanted: number;
  /**
   * Share of planted bugs the AI must catch to leave Shadow. With 3 planted,
   * 0.6 means 2 caught passes and 1 does not. Higher, a single miss in a small
   * sample keeps an area at Shadow; lower, an unreliable reviewer earns
   * Calibrated.
   */
  minCatchRate: number;
  /**
   * Clean human spot checks needed on top of calibration to reach Trusted. 5 is a
   * judgement (spec section 5): too few lets a short clean streak route Light,
   * too many is a check workload nobody keeps up.
   */
  spotChecksForTrusted: number;
}

/** The ladder thresholds of Tieto's MessagePack-CSharp fork; the report card cites them. */
export const ladderPolicy: LadderPolicy = {
  minPlanted: 3,
  minCatchRate: 0.6,
  spotChecksForTrusted: 5,
};
