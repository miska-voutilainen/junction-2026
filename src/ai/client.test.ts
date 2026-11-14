import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createModelClient } from "./client";
import { parseClaudeCodeOutput } from "./claudeCodeTransport";
import {
  ModelRefusalError,
  ModelValidationError,
  RecordingMissingError,
} from "./errors";
import { recordingKey } from "./recordings";
import type { Transport, TransportResponse, UsageEntry } from "./types";
import { costOf } from "./usageLog";

const schema = z.object({ verdict: z.enum(["ok", "bad"]) });
const request = {
  promptVersion: "t.v1",
  system: "system",
  prompt: "rendered prompt",
  schema,
};
const usage = { inputTokens: 1000, outputTokens: 500 };

function answering(...texts: string[]): {
  transport: Transport;
  prompts: string[];
} {
  const prompts: string[] = [];
  const transport: Transport = async ({ prompt }) => {
    prompts.push(prompt);
    const text = texts[Math.min(prompts.length - 1, texts.length - 1)];
    return { text, usage, isRefusal: false };
  };
  return { transport, prompts };
}

describe("model client", () => {
  let directory: string;
  let entries: UsageEntry[];
  const usageSink = (entry: UsageEntry) => entries.push(entry);

  beforeEach(async () => {
    directory = await mkdtemp(path.join(os.tmpdir(), "recordings-"));
    entries = [];
  });
  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it("returns the validated answer and logs tokens and cost without content", async () => {
    const { transport } = answering('{"verdict":"ok"}');
    const client = createModelClient({
      mode: "live",
      transport,
      recordingsDirectory: directory,
      usageSink,
    });

    await expect(client.call(request)).resolves.toEqual({ verdict: "ok" });

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      promptVersion: "t.v1",
      inputTokens: 1000,
      outputTokens: 500,
      source: "model",
    });
    // 1000 * $4/M + 500 * $20/M
    expect(entries[0].costUsd).toBeCloseTo(0.014);
    expect(JSON.stringify(entries[0])).not.toContain("rendered prompt");
  });

  it("retries once with the validation error and sums usage over both asks", async () => {
    const { transport, prompts } = answering(
      '{"verdict":"maybe"}',
      '{"verdict":"bad"}',
    );
    const client = createModelClient({
      mode: "live",
      transport,
      recordingsDirectory: directory,
      usageSink,
    });

    await expect(client.call(request)).resolves.toEqual({ verdict: "bad" });

    expect(prompts).toHaveLength(2);
    expect(prompts[1]).toContain("verdict");
    expect(prompts[1]).toContain("rendered prompt");
    expect(entries[0].inputTokens).toBe(2000);
  });

  it("fails the step after a second validation failure", async () => {
    const { transport, prompts } = answering("not json", "still not json");
    const client = createModelClient({
      mode: "live",
      transport,
      recordingsDirectory: directory,
      usageSink,
    });

    await expect(client.call(request)).rejects.toBeInstanceOf(
      ModelValidationError,
    );
    expect(prompts).toHaveLength(2);
  });

  it("accepts an answer wrapped in a json code fence", async () => {
    const { transport } = answering('```json\n{"verdict":"ok"}\n```');
    const client = createModelClient({
      mode: "live",
      transport,
      recordingsDirectory: directory,
      usageSink,
    });
    await expect(client.call(request)).resolves.toEqual({ verdict: "ok" });
  });

  it("fails the step on a refusal without retrying", async () => {
    const transport = vi.fn<Transport>(
      async (): Promise<TransportResponse> => ({
        text: "",
        usage,
        isRefusal: true,
      }),
    );
    const client = createModelClient({
      mode: "live",
      transport,
      recordingsDirectory: directory,
      usageSink,
    });

    await expect(client.call(request)).rejects.toBeInstanceOf(
      ModelRefusalError,
    );
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("names the missing recording and the command to make it on a replay miss", async () => {
    const transport = vi.fn<Transport>();
    const client = createModelClient({
      mode: "replay",
      transport,
      recordingsDirectory: directory,
      usageSink,
    });

    const failure = await client.call(request).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(RecordingMissingError);
    expect((failure as Error).message).toContain("t.v1");
    expect((failure as Error).message).toContain(directory);
    expect((failure as Error).message).toContain("AI_MODE=record");
    expect(transport).not.toHaveBeenCalled();
  });

  it("replays what record saved, without calling the model", async () => {
    const { transport } = answering('{"verdict":"ok"}');
    await createModelClient({
      mode: "record",
      transport,
      recordingsDirectory: directory,
      usageSink,
    }).call(request);
    expect(await readdir(directory)).toHaveLength(1);

    const offline = vi.fn<Transport>();
    const replayed = await createModelClient({
      mode: "replay",
      transport: offline,
      recordingsDirectory: directory,
      usageSink,
    }).call(request);

    expect(replayed).toEqual({ verdict: "ok" });
    expect(offline).not.toHaveBeenCalled();
    expect(entries.at(-1)).toMatchObject({
      source: "replay",
      inputTokens: 1000,
    });
  });

  it("does not save in live mode and keys runs apart by run index", async () => {
    const { transport } = answering('{"verdict":"ok"}');
    await createModelClient({
      mode: "live",
      transport,
      recordingsDirectory: directory,
      usageSink,
    }).call(request);
    expect(await readdir(directory)).toHaveLength(0);

    expect(recordingKey("t.v1", "p", 0)).not.toBe(recordingKey("t.v1", "p", 1));
    expect(recordingKey("t.v1", "p", 0)).toBe(recordingKey("t.v1", "p", 0));
  });
});

describe("cost", () => {
  it("prefers the cost the backend reported", () => {
    expect(
      costOf({ inputTokens: 1_000_000, outputTokens: 0, costUsd: 0.5 }),
    ).toBe(0.5);
    expect(costOf({ inputTokens: 1_000_000, outputTokens: 1_000_000 })).toBe(
      24,
    );
  });
});

describe("claude code output", () => {
  it("reads the answer, tokens including cache and the reported cost", () => {
    const response = parseClaudeCodeOutput(
      JSON.stringify({
        is_error: false,
        result: '{"verdict":"ok"}',
        total_cost_usd: 0.07,
        usage: {
          input_tokens: 10,
          cache_read_input_tokens: 90,
          output_tokens: 5,
        },
      }),
    );
    expect(response).toEqual({
      text: '{"verdict":"ok"}',
      isRefusal: false,
      usage: { inputTokens: 100, outputTokens: 5, costUsd: 0.07 },
    });
  });

  it("marks a refusal stop reason and fails on any other error", () => {
    expect(
      parseClaudeCodeOutput(
        JSON.stringify({ is_error: true, stop_reason: "refusal" }),
      ).isRefusal,
    ).toBe(true);
    expect(() =>
      parseClaudeCodeOutput(
        JSON.stringify({ is_error: true, result: "Not logged in" }),
      ),
    ).toThrow(/logged in/);
  });
});
