import { z } from "zod";

/** data/sample/requirements/<id>.json (producer: evidence lane). */
export const RequirementSchema = z.strictObject({
  id: z.string(), // "MP-2283"
  title: z.string(),
  intent: z.string(),
  functional: z.array(z.strictObject({ id: z.string(), text: z.string() })), // id "F1"
  nonFunctional: z.array(z.strictObject({ id: z.string(), text: z.string() })), // id "N1"
  derivedFrom: z.strictObject({
    kind: z.literal("github-issue"),
    url: z.string(),
    note: z.string(),
  }),
});
export type Requirement = z.infer<typeof RequirementSchema>;
