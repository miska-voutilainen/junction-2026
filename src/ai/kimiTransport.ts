import { z } from "zod";
import { ModelTruncatedError } from "./errors";
import {
  KIMI_BASE_URL,
  KIMI_INPUT_USD_PER_MILLION_TOKENS,
  KIMI_MAX_TOKENS,
  KIMI_MODEL,
  KIMI_OUTPUT_USD_PER_MILLION_TOKENS,
  KIMI_REASONING_EFFORT,
} from "./limits";
import type { Transport } from "./types";

/** The part of Verda's chat-completions answer this transport reads. */
interface KimiCompletion {
  model: string;
  choices: { message: { content: string | null }; finish_reason: string }[];
  usage: { prompt_tokens: number; completion_tokens: number };
}

/**
 * Kimi backend: Verda Inference's OpenAI-compatible chat completions, used for the CI
 * canary and for trying the reviewer on an open model. Verda documents JSON mode but
 * not schema enforcement, so the schema goes into the system text and the client's
 * validate-and-retry layer is what holds the answer to it. One non-streaming request
 * per call: the server times those out at 60 s, so this backend suits short prompts;
 * a full review of a large change needs streaming first. The key is read from
 * KIMI_API_KEY at call time and never logged.
 */
export const kimiTransport: Transport = async (
  { system, prompt, schema, promptVersion },
  signal,
) => {
  const apiKey = process.env.KIMI_API_KEY;
  if (!apiKey)
    throw new Error(
      "KIMI_API_KEY is not set. Add it to .env (see .env.example) or, in CI, to the repository's Actions secrets.",
    );

  const response = await fetch(`${KIMI_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: KIMI_MODEL,
      messages: [
        { role: "system", content: `${system}\n\n${schemaInstruction(schema)}` },
        { role: "user", content: prompt },
      ],
      max_tokens: KIMI_MAX_TOKENS,
      // The model's default effort is max, which spends the whole token budget thinking.
      reasoning_effort: KIMI_REASONING_EFFORT,
      response_format: { type: "json_object" },
    }),
    signal,
  });
  if (!response.ok) throw new Error(await describeFailure(response));

  const completion = (await response.json()) as KimiCompletion;
  const [choice] = completion.choices;
  // Reasoning tokens share max_tokens; running out leaves content empty or cut off.
  if (!choice || choice.finish_reason === "length")
    throw new ModelTruncatedError(promptVersion, KIMI_MAX_TOKENS);

  const { prompt_tokens: inputTokens, completion_tokens: outputTokens } = completion.usage;
  return {
    text: choice.message.content ?? "",
    model: completion.model,
    isRefusal: false,
    usage: {
      inputTokens,
      outputTokens,
      costUsd:
        (inputTokens * KIMI_INPUT_USD_PER_MILLION_TOKENS +
          outputTokens * KIMI_OUTPUT_USD_PER_MILLION_TOKENS) /
        1_000_000,
    },
  };
};

function schemaInstruction(schema: z.ZodType): string {
  return `Answer with one JSON object that matches this JSON Schema and nothing else:\n${JSON.stringify(z.toJSONSchema(schema))}`;
}

/** Names the status and Verda's error code, with what to do for the ones that have a fix. */
async function describeFailure(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as {
    error?: { code?: string; message?: string };
  } | null;
  const code = body?.error?.code ?? "unknown";
  const hint =
    response.status === 401
      ? " KIMI_API_KEY was rejected: it must be a Verda inference key, not a cloud API credential."
      : response.status === 402
        ? " The Verda balance is too low; top it up in the console."
        : response.status === 429
          ? " Rate limited or the model is busy; wait and retry."
          : "";
  return `Verda inference answered ${response.status} (${code}).${hint}`;
}
