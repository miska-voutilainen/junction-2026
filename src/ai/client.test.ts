import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createModelClient } from "./client";
import { toTransportResult } from "./claudeCodeTransport";
import { recordingKey } from "./recordings";
import {
  ModelRefusalError,
  ModelValidationError,
  RecordingMissingError,
  RecordingStaleError,
} from "./errors";
import type { Transport, TransportResponse, UsageEntry } from "./types";
import { costOf } from "./usageLog";

const schema = z.object({ verdict: z.enum(["ok", "bad"]) });
const request = {
  promptVersion: "t.v1",
  system: "system",
  prompt: "rendered prompt",
  schema,
};
const model = "claude-opus-5-5";
const usage = { inputTokens: 1000, outputTokens: 500 };

function answering(...texts: string[]): {
  transport: Transport;
  prompts: string[];
} {
  const prompts: string[] = [];
  const transport: Transport = async ({ prompt }) => {
    prompts.push(prompt);
    const text = texts[Math.min(prompts.length - 1, texts.length - 1)];
    return { text, usage, model, isRefusal: false };
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

  it("retries once with the validation error and logs both responses", async () => {
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
    expect(entries.map((entry) => entry.outcome)).toEqual(["invalid", "ok"]);
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
        model,
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

  it("replays a call that needed a retry as the same number of requests", async () => {
    const { transport } = answering('{"verdict":"maybe"}', '{"verdict":"ok"}');
    await createModelClient({
      mode: "record",
      transport,
      recordingsDirectory: directory,
      usageSink,
    }).call(request);
    entries.length = 0;

    await createModelClient({
      mode: "replay",
      transport: vi.fn<Transport>(),
      recordingsDirectory: directory,
      usageSink,
    }).call(request);

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ source: "replay", requests: 2 });
  });

  it("saves nothing in live mode", async () => {
    const { transport } = answering('{"verdict":"ok"}');
    await createModelClient({
      mode: "live",
      transport,
      recordingsDirectory: directory,
      usageSink,
    }).call(request);
    expect(await readdir(directory)).toHaveLength(0);
  });

  it("keys runs apart by run index and repeats the key for the same inputs", () => {
    expect(recordingKey("t.v1", "p", 0)).not.toBe(recordingKey("t.v1", "p", 1));
    expect(recordingKey("t.v1", "p", 0)).toBe(recordingKey("t.v1", "p", 0));
  });

  it("stores the raw answer text and replays it through the same validation", async () => {
    const fenced = ["```json", '{"verdict":"ok"}', "```"].join("\n");
    const { transport } = answering(fenced);
    await createModelClient({
      mode: "record",
      transport,
      recordingsDirectory: directory,
      usageSink,
    }).call(request);
    const [name] = await readdir(directory);
    expect(await readFile(path.join(directory, name), "utf8")).toContain(
      "```json",
    );

    const stricter = {
      ...request,
      schema: z.object({ verdict: z.literal("bad") }),
    };
    const replayed = createModelClient({
      mode: "replay",
      transport: vi.fn<Transport>(),
      recordingsDirectory: directory,
      usageSink,
    });
    await expect(replayed.call(stricter)).rejects.toBeInstanceOf(
      RecordingStaleError,
    );
  });

  it("counts refusals and rejected answers in the usage log", async () => {
    const refusing = vi.fn<Transport>(async () => ({
      text: "",
      usage,
      model,
      isRefusal: true,
    }));
    await createModelClient({
      mode: "live",
      transport: refusing,
      recordingsDirectory: directory,
      usageSink,
    })
      .call(request)
      .catch(() => undefined);
    const { transport } = answering("nope", "nope");
    await createModelClient({
      mode: "live",
      transport,
      recordingsDirectory: directory,
      usageSink,
    })
      .call(request)
      .catch(() => undefined);

    expect(entries.map((entry) => entry.outcome)).toEqual([
      "refusal",
      "invalid",
      "invalid",
    ]);
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

describe("recording key", () => {
  it("matches the committed smoke recording (golden)", async () => {
    // Changing the key derivation orphans every committed recording; this test says so first.
    const prompt = 'Return {"greeting": "hello", "sum": <the sum of 2 and 3>}.';
    const key = recordingKey("smoke.v1", prompt, 0);
    const file = path.join(
      "data",
      "recordings",
      `smoke.v1-${key.slice(0, 16)}.json`,
    );
    const recording = JSON.parse(await readFile(file, "utf8"));
    expect(recording.promptVersion).toBe("smoke.v1");
    expect(JSON.parse(recording.rawAnswer)).toEqual({
      greeting: "hello",
      sum: 5,
    });
  });
});

describe("claude code result", () => {
  const envelope = (fields: object) => JSON.stringify(fields);

  it("reads the answer, tokens including cache and the reported cost", () => {
    const response = toTransportResult(
      0,
      envelope({
        is_error: false,
        result: '{"verdict":"ok"}',
        total_cost_usd: 0.07,
        usage: {
          input_tokens: 10,
          cache_read_input_tokens: 90,
          output_tokens: 5,
        },
      }),
      "",
    );
    expect(response).toEqual({
      text: '{"verdict":"ok"}',
      model,
      isRefusal: false,
      usage: { inputTokens: 100, outputTokens: 5, costUsd: 0.07 },
    });
  });

  it("prefers structured_output over prose in result", () => {
    const response = toTransportResult(
      0,
      envelope({
        result: "Here you go.",
        structured_output: { verdict: "ok" },
      }),
      "",
    );
    expect(JSON.parse(response.text)).toEqual({ verdict: "ok" });
  });

  it("reads the error envelope of a non-zero exit before the exit code", () => {
    expect(() =>
      toTransportResult(
        1,
        envelope({ is_error: true, result: "Not logged in" }),
        "stderr text",
      ),
    ).toThrow(/logged in/);
    expect(
      toTransportResult(
        1,
        envelope({ is_error: true, stop_reason: "refusal" }),
        "",
      ).isRefusal,
    ).toBe(true);
  });

  it("falls back to the exit code and stderr when stdout is not JSON", () => {
    expect(() => toTransportResult(2, "", "boom: bad flag")).toThrow(
      /code 2.*boom: bad flag/,
    );
  });
});
