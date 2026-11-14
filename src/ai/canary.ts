/**
 * `pnpm ai:canary`: one small live call through the Kimi backend and the real client
 * (render, ask, validate, retry once). It fails when the key, the endpoint, the model
 * id or schema-valid output stops working, which a replayed run can't notice. It scores
 * nothing: it is not an eval, and costs a fraction of a cent.
 */
import { z } from "zod";
import { createModelClient } from "./client";
import { kimiTransport } from "./kimiTransport";

const answerSchema = z.object({ ok: z.literal(true), word: z.string().min(1) });

async function main(): Promise<void> {
  const client = createModelClient({ mode: "live", transport: kimiTransport });
  const answer = await client.call({
    promptVersion: "canary.v1",
    system: "You answer with one JSON object and nothing else.",
    prompt: 'Return {"ok": true, "word": "<any single English word>"}.',
    schema: answerSchema,
  });
  console.log(`canary · kimi answered with a schema-valid object (word: ${answer.word})`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
