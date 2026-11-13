import { z } from "zod";
import { AreaSchema, IsoTimestampSchema, LadderLevelSchema } from "./common";

const nonNegInt = z.number().int().nonnegative();
const CaughtOfTotalSchema = z.strictObject({ caught: nonNegInt, total: nonNegInt });

/** data/eval/report-card.json (producer: engine lane). */
export const ReportCardSchema = z.strictObject({
  schemaVersion: z.literal(1),
  generatedAt: IsoTimestampSchema,
  reviewer: z.strictObject({ version: z.string(), model: z.string() }),
  areas: z.array(
    z.strictObject({
      area: AreaSchema,
      planted: nonNegInt,
      caught: nonNegInt,
      spotChecksClean: nonNegInt,
      level: LadderLevelSchema,
      plants: z.array(
        z.strictObject({
          plantId: z.string(),
          changeId: z.string(),
          caught: z.boolean(),
          findingId: z.string().nullable(),
          defect: z.string(),
          variantUrl: z.string(), // https://github.com/<fork>/commit/<headSha>
        }),
      ),
    }),
  ),
  anchoredVsBlind: z.strictObject({
    plants: nonNegInt,
    runsPerMode: nonNegInt,
    anchored: CaughtOfTotalSchema,
    blind: CaughtOfTotalSchema,
    perPlant: z.array(
      z.strictObject({
        plantId: z.string(),
        changeId: z.string(),
        statement: z.string(),
        anchoredCaught: nonNegInt,
        blindCaught: nonNegInt,
        runs: nonNegInt,
      }),
    ),
  }),
  hallucinations: z.strictObject({
    quotesChecked: nonNegInt,
    quoteFailures: nonNegInt,
    claimsRetracted: nonNegInt,
    findingsDropped: nonNegInt,
  }),
  findingsOnPlants: z.strictObject({ total: nonNegInt, matchedPlant: nonNegInt }),
  routingSpread: z.strictObject({
    changes: nonNegInt,
    light: nonNegInt,
    focused: nonNegInt,
    full: nonNegInt,
    readHunks: nonNegInt,
    totalHunks: nonNegInt,
    readMinutes: z.number().nonnegative(),
    fullMinutes: z.number().nonnegative(),
  }),
});
export type ReportCard = z.infer<typeof ReportCardSchema>;
