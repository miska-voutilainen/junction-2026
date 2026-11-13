import { z } from "zod";
import { CoverageSchema, TierSchema } from "./common";

/** Output of route(), embedded as Review.routing in data/runs/<changeId>/review.json (producer: engine lane). */
export const TierDecisionSchema = z.strictObject({
  tier: TierSchema,
  reasons: z.array(
    z.strictObject({ ruleId: z.string(), text: z.string(), tier: TierSchema }),
  ),
  coverage: z.record(z.string(), CoverageSchema), // key: hunkId
  readHunks: z.number().int().nonnegative(),
  totalHunks: z.number().int().nonnegative(),
  readLines: z.number().int().nonnegative(),
  totalLines: z.number().int().nonnegative(),
  readMinutes: z.number().nonnegative(),
  fullMinutes: z.number().nonnegative(),
});
export type TierDecision = z.infer<typeof TierDecisionSchema>;
