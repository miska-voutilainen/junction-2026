import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import {
  API_FALLBACK_BETA,
  API_MAX_RETRIES,
  API_MAX_TOKENS,
  API_REQUEST_TIMEOUT_MS,
  EFFORT,
  MODEL,
} from "./limits";
import type { Transport } from "./types";

/**
 * API backend: the official SDK with structured outputs (the schema constrains the
 * answer), effort high, adaptive thinking (the model default) and the server-side
 * refusal fallback. No temperature: the model removed it. Spec section 6.
 * The key comes from ANTHROPIC_API_KEY, read by the SDK.
 */
export const apiTransport: Transport = async (
  { system, prompt, schema },
  signal,
) => {
  const client = new Anthropic({
    timeout: API_REQUEST_TIMEOUT_MS,
    maxRetries: API_MAX_RETRIES,
  });
  const message = await client.beta.messages.create(
    {
      model: MODEL,
      max_tokens: API_MAX_TOKENS,
      system,
      messages: [{ role: "user", content: prompt }],
      output_config: { effort: EFFORT, format: zodOutputFormat(schema) },
      betas: [API_FALLBACK_BETA],
      fallbacks: "default",
    },
    { signal },
  );
  const text = message.content
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("");
  return {
    text,
    isRefusal: message.stop_reason === "refusal",
    usage: {
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
    },
  };
};
