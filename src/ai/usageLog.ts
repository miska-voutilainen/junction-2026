import { INPUT_USD_PER_MILLION_TOKENS, OUTPUT_USD_PER_MILLION_TOKENS } from "./limits";
import type { Usage, UsageEntry } from "./types";

/** Cost in US dollars: what the backend reported, else tokens times the partner price. */
export function costOf(usage: Usage): number {
  if (usage.costUsd !== undefined) return usage.costUsd;
  return (
    (usage.inputTokens * INPUT_USD_PER_MILLION_TOKENS +
      usage.outputTokens * OUTPUT_USD_PER_MILLION_TOKENS) /
    1_000_000
  );
}

/** Where usage lines go. */
export type UsageSink = (entry: UsageEntry) => void;

/** Default sink: one JSON line per call on stderr with model, version, tokens, cost and time, never content. */
export const stderrUsageSink: UsageSink = (entry) => {
  process.stderr.write(`${JSON.stringify({ event: "model-call", ...entry })}\n`);
};
