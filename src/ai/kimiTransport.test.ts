import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ModelTruncatedError } from "./errors";
import { kimiTransport } from "./kimiTransport";
import { KIMI_MODEL } from "./limits";

const call = {
  promptVersion: "canary.v1",
  system: "Answer in JSON.",
  prompt: "Say ok.",
  schema: z.object({ ok: z.literal(true) }),
};

function reply(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe("kimiTransport", () => {
  const fetchSpy = vi.fn();

  beforeEach(() => {
    vi.stubEnv("KIMI_API_KEY", "test-key");
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    fetchSpy.mockReset();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("sends JSON mode, low reasoning effort and the schema, and prices the tokens", async () => {
    fetchSpy.mockResolvedValue(
      reply({
        model: KIMI_MODEL,
        choices: [{ message: { content: '{"ok":true}' }, finish_reason: "stop" }],
        usage: { prompt_tokens: 1_000_000, completion_tokens: 100_000 },
      }),
    );

    const response = await kimiTransport(call, new AbortController().signal);

    const [url, init] = fetchSpy.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(url).toBe("https://inference.verda.com/v1/chat/completions");
    expect(init.headers.Authorization).toBe("Bearer test-key");
    expect(body).toMatchObject({
      model: KIMI_MODEL,
      reasoning_effort: "low",
      response_format: { type: "json_object" },
    });
    expect(body.messages[0].content).toContain('"ok"');
    expect(response.text).toBe('{"ok":true}');
    // $2 per million in, $10 per million out: 1M in + 0.1M out.
    expect(response.usage.costUsd).toBeCloseTo(3);
  });

  it("fails with the fix when the key is missing", async () => {
    vi.stubEnv("KIMI_API_KEY", "");
    await expect(kimiTransport(call, new AbortController().signal)).rejects.toThrow(
      /KIMI_API_KEY is not set/,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("names the status and the fix for a rejected key", async () => {
    fetchSpy.mockResolvedValue(reply({ error: { code: "invalid_api_key" } }, 401));
    await expect(kimiTransport(call, new AbortController().signal)).rejects.toThrow(
      /401 \(invalid_api_key\).*inference key/,
    );
  });

  it("reports an answer cut off by the token cap instead of returning half a JSON object", async () => {
    fetchSpy.mockResolvedValue(
      reply({
        model: KIMI_MODEL,
        choices: [{ message: { content: "" }, finish_reason: "length" }],
        usage: { prompt_tokens: 10, completion_tokens: 4_000 },
      }),
    );
    await expect(kimiTransport(call, new AbortController().signal)).rejects.toBeInstanceOf(
      ModelTruncatedError,
    );
  });
});
