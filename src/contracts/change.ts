import { z } from "zod";
import { AreaSchema, IsoTimestampSchema, ShaSchema } from "./common";

/** data/sample/changes/<id>.json (producer: evidence lane). */
export const ChangeInputSchema = z.strictObject({
  id: z.string(), // "mp-2283" | "v01" | "cp1"
  kind: z.enum(["tieto", "planted-bug", "contradiction-plant"]),
  title: z.string(),
  requirementId: z.string(),
  parentChangeId: z.string().nullable(), // set for v<nn> and cp<n>
  repo: z.string(),
  branch: z.string(),
  baseSha: ShaSchema,
  headSha: ShaSchema,
  authorAgent: z.string(),
  authorDescription: z.strictObject({
    text: z.string(),
    synthetic: z.boolean(),
    writtenBy: z.string(),
  }),
});
export type ChangeInput = z.infer<typeof ChangeInputSchema>;

/** data/sample/answer-key/<plantId>.json (producer: evidence lane; engine scoring only, never in a prompt). */
export const AnswerKeySchema = z.strictObject({
  plantId: z.string(),
  changeId: z.string(),
  kind: z.enum(["planted-bug", "contradiction"]),
  area: AreaSchema.nullable(),
  file: z.string().nullable(),
  startLine: z.number().int().positive().nullable(),
  endLine: z.number().int().positive().nullable(),
  defect: z.string(), // planted bug: the defect; contradiction: the exact false sentence
  why: z.string(),
  writtenBy: z.string(),
  writtenAt: IsoTimestampSchema,
});
export type AnswerKey = z.infer<typeof AnswerKeySchema>;
