import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createModelClient } from "./client";
import { ModelTimeoutError } from "./errors";
import type { Transport, UsageEntry } from "./types";

// A 20 ms timeout instead of 180 s, so the test waits on the real abort signal.
vi.mock("./limits", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./limits")>()),
  CALL_TIMEOUT_MS: 20,
}));

describe("per-request time budget", () => {
  it("stops a transport that never answers and logs a timeout", async () => {
    const hanging: Transport = (_call, signal) =>
      new Promise((_resolve, reject) =>
        signal.addEventListener("abort", () => reject(signal.reason)),
      );
    const entries: UsageEntry[] = [];
    const client = createModelClient({
      mode: "live",
      transport: hanging,
      usageSink: (entry) => entries.push(entry),
    });

    await expect(
      client.call({
        promptVersion: "t.v1",
        system: "s",
        prompt: "p",
        schema: z.object({}),
      }),
    ).rejects.toBeInstanceOf(ModelTimeoutError);
    expect(entries.map((entry) => entry.outcome)).toEqual(["timeout"]);
  });
});
