import type { z } from "zod";

/** Result of checking a model answer against a schema; `problem` is written to be sent back to the model. */
export type Checked<T> = { ok: true; value: T } | { ok: false; problem: string };

/**
 * Parses the model's raw text as JSON and validates it. Used both for fresh answers and for
 * replayed recordings, so a recording passes exactly the check the live answer passed.
 */
export function validateAnswer<T>(text: string, schema: z.ZodType<T>): Checked<T> {
  let json: unknown;
  try {
    json = JSON.parse(stripCodeFence(text));
  } catch {
    return { ok: false, problem: "the answer is not valid JSON" };
  }
  const parsed = schema.safeParse(json);
  if (parsed.success) return { ok: true, value: parsed.data };
  return {
    ok: false,
    problem: parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; "),
  };
}

/** Models sometimes wrap JSON in a ```json fence despite instructions; unwrap it before parsing. */
function stripCodeFence(text: string): string {
  const fenced = /^\s*```(?:json)?\s*([\s\S]*?)\s*```\s*$/.exec(text);
  return fenced ? fenced[1] : text;
}
