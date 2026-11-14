import { stderrUsageSink, type UsageSink } from "../ai/usageLog";
import type { Review } from "../contracts";

/** Adds up the model calls of one run for `Review.run.usage`. */
export interface UsageTally {
  /** Pass to the model client; it also forwards each line to stderr. */
  sink: UsageSink;
  totals(): Review["run"]["usage"];
}

/**
 * Counts every request the client logs, retries included (spec 9.1: `calls` counts
 * API requests). In replay mode the lines carry the recorded cost, so a replayed
 * review reports what the recorded one cost.
 */
export function createUsageTally(): UsageTally {
  const totals = { inputTokens: 0, outputTokens: 0, costUsd: 0, calls: 0 };
  return {
    sink(entry) {
      totals.inputTokens += entry.inputTokens;
      totals.outputTokens += entry.outputTokens;
      totals.costUsd += entry.costUsd;
      totals.calls += 1;
      stderrUsageSink(entry);
    },
    totals: () => ({ ...totals }),
  };
}
