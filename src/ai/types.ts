import type { z } from "zod";

/** Which backend answers: Claude Code on the operator's subscription, or the Anthropic API. */
export type AiBackend = "claude-code" | "api";

/** record: call and save; replay: read recordings only; live: call without saving. */
export type AiMode = "record" | "replay" | "live";

/** What one model call sends. `prompt` is the rendered user text of a prompt module. */
export interface ModelRequest {
  /** Prompt version such as "a2.v1"; part of the recording key. */
  promptVersion: string;
  system: string;
  prompt: string;
  /** Validates the model's JSON answer and, for the API backend, constrains it. */
  schema: z.ZodType;
  /** Distinguishes repeated calls with the same prompt (eval repeats); defaults to 0. */
  runIndex?: number;
}

/** Tokens and cost of one call. `costUsd` is set when the backend reports it, else computed from tokens. */
export interface Usage {
  inputTokens: number;
  outputTokens: number;
  costUsd?: number;
}

/** What a transport hands back before validation. `text` is the model's raw answer. */
export interface TransportResponse {
  text: string;
  usage: Usage;
  /** The model that answered; differs from the requested one when the server-side fallback replied. */
  model: string;
  /** True when the model declined (stop reason `refusal`) even after any server-side fallback. */
  isRefusal: boolean;
}

/** One round trip to a backend. Tests supply a fake; production uses claude-code or api. */
export type Transport = (
  call: {
    promptVersion: string;
    system: string;
    prompt: string;
    schema: z.ZodType;
  },
  signal: AbortSignal,
) => Promise<TransportResponse>;

/** One usage log line. Never carries prompt or answer text. */
export interface UsageEntry {
  model: string;
  promptVersion: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  milliseconds: number;
  /** How the response ended: accepted, refused, or rejected by the schema. A timeout has no tokens. */
  outcome: "ok" | "refusal" | "invalid" | "timeout";
  /** "replay" lines report the recorded cost, which this run did not spend. */
  source: "model" | "replay";
  /** Requests this line stands for. Absent means one; a replayed call reports the requests it made when recorded. */
  requests?: number;
}
