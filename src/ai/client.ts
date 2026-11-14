/**
 * The one model client. Every review step calls the model here and nowhere else, so
 * validation, retry, refusal handling, recording and cost logging are written once.
 * A call is: render, ask, validate against the call's zod schema, retry once with the
 * validation error, record. In replay mode no model is called at all, which is what
 * lets the demo and the tests run offline on byte-identical answers.
 * Spec section 6, "Model and client".
 */
import path from "node:path";
import type { z } from "zod";
import { apiTransport } from "./apiTransport";
import { claudeCodeTransport } from "./claudeCodeTransport";
import {
  ModelRefusalError,
  ModelTimeoutError,
  ModelValidationError,
  RecordingMissingError,
} from "./errors";
import { CALL_TIMEOUT_MS, MAX_VALIDATION_RETRIES, MODEL } from "./limits";
import {
  readRecording,
  recordingKey,
  recordingPath,
  writeRecording,
} from "./recordings";
import type {
  AiBackend,
  AiMode,
  ModelRequest,
  Transport,
  Usage,
} from "./types";
import { costOf, stderrUsageSink, type UsageSink } from "./usageLog";

/** Default recordings folder, relative to the repository root where the CLIs run. */
const DEFAULT_RECORDINGS_DIRECTORY = path.join("data", "recordings");

/** What a client needs. Production builds it from the environment; tests pass a fake transport. */
export interface ModelClientOptions {
  mode: AiMode;
  transport: Transport;
  recordingsDirectory?: string;
  usageSink?: UsageSink;
}

/** The client's one operation: send a request, get a validated answer of the schema's type. */
export interface ModelClient {
  call<T>(request: ModelRequest & { schema: z.ZodType<T> }): Promise<T>;
}

/**
 * Builds a client over a transport.
 *
 * @example
 * const client = createModelClient({ mode: "replay", transport: apiTransport });
 * const review = await client.call({ promptVersion: "a2.v1", system, prompt, schema });
 */
export function createModelClient(options: ModelClientOptions): ModelClient {
  const directory = options.recordingsDirectory ?? DEFAULT_RECORDINGS_DIRECTORY;
  const logUsage = options.usageSink ?? stderrUsageSink;

  return {
    async call<T>(
      request: ModelRequest & { schema: z.ZodType<T> },
    ): Promise<T> {
      const runIndex = request.runIndex ?? 0;
      const key = recordingKey(request.promptVersion, request.prompt, runIndex);
      const file = recordingPath(directory, request.promptVersion, key);

      if (options.mode === "replay") return replay(request, file, logUsage);

      const startedAt = Date.now();
      const { answer, usage } = await askUntilValid(options.transport, request);
      logUsage({
        model: MODEL,
        promptVersion: request.promptVersion,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        costUsd: costOf(usage),
        milliseconds: Date.now() - startedAt,
        source: "model",
      });
      if (options.mode === "record") {
        await writeRecording(file, {
          model: MODEL,
          promptVersion: request.promptVersion,
          runIndex,
          answer,
          usage,
        });
      }
      return answer;
    },
  };
}

/**
 * Client from the environment: AI_BACKEND (default claude-code) picks the transport,
 * AI_MODE (default record) picks record, replay or live.
 *
 * @throws if AI_BACKEND or AI_MODE hold a value other than the documented ones.
 */
export function createModelClientFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): ModelClient {
  const backend = parseChoice<AiBackend>(
    "AI_BACKEND",
    env.AI_BACKEND,
    "claude-code",
    ["claude-code", "api"],
  );
  const mode = parseChoice<AiMode>("AI_MODE", env.AI_MODE, "record", [
    "record",
    "replay",
    "live",
  ]);
  return createModelClient({
    mode,
    transport: backend === "api" ? apiTransport : claudeCodeTransport,
  });
}

function parseChoice<T extends string>(
  name: string,
  value: string | undefined,
  fallback: T,
  allowed: T[],
): T {
  if (!value) return fallback;
  if ((allowed as string[]).includes(value)) return value as T;
  throw new Error(
    `${name}=${value} is not valid. Use one of: ${allowed.join(", ")}. See .env.example.`,
  );
}

async function replay<T>(
  request: ModelRequest & { schema: z.ZodType<T> },
  file: string,
  logUsage: UsageSink,
): Promise<T> {
  const recording = await readRecording(file);
  if (!recording) throw new RecordingMissingError(request.promptVersion, file);
  // A recording that no longer fits the schema means the schema changed without a version bump.
  const answer = request.schema.parse(recording.answer);
  logUsage({
    model: recording.model,
    promptVersion: request.promptVersion,
    inputTokens: recording.usage.inputTokens,
    outputTokens: recording.usage.outputTokens,
    costUsd: costOf(recording.usage),
    milliseconds: 0,
    source: "replay",
  });
  return answer;
}

/** Asks, validates, and on a schema failure asks once more with the error appended. Usage sums both asks. */
async function askUntilValid<T>(
  transport: Transport,
  request: ModelRequest & { schema: z.ZodType<T> },
): Promise<{ answer: T; usage: Usage }> {
  let prompt = request.prompt;
  const total: Usage = { inputTokens: 0, outputTokens: 0, costUsd: 0 };
  let lastProblem = "";

  for (let attempt = 0; attempt <= MAX_VALIDATION_RETRIES; attempt++) {
    const response = await askOnce(transport, request, prompt);
    total.inputTokens += response.usage.inputTokens;
    total.outputTokens += response.usage.outputTokens;
    total.costUsd = (total.costUsd ?? 0) + costOf(response.usage);
    if (response.isRefusal) throw new ModelRefusalError(request.promptVersion);

    const checked = validate(response.text, request.schema);
    if (checked.ok) return { answer: checked.value, usage: total };

    lastProblem = checked.problem;
    prompt =
      `${request.prompt}\n\nYour previous answer was rejected: ${checked.problem}\n` +
      `Answer again with only the corrected JSON.`;
  }
  throw new ModelValidationError(request.promptVersion, lastProblem);
}

/** One transport call under the per-call time budget. */
async function askOnce<T>(
  transport: Transport,
  request: ModelRequest & { schema: z.ZodType<T> },
  prompt: string,
) {
  const signal = AbortSignal.timeout(CALL_TIMEOUT_MS);
  try {
    return await transport(
      { system: request.system, prompt, schema: request.schema },
      signal,
    );
  } catch (error) {
    if (signal.aborted)
      throw new ModelTimeoutError(
        request.promptVersion,
        CALL_TIMEOUT_MS / 1000,
      );
    throw error;
  }
}

type Checked<T> = { ok: true; value: T } | { ok: false; problem: string };

function validate<T>(text: string, schema: z.ZodType<T>): Checked<T> {
  let json: unknown;
  try {
    json = JSON.parse(stripCodeFence(text));
  } catch {
    return { ok: false, problem: "the answer is not valid JSON" };
  }
  const parsed = schema.safeParse(json);
  if (parsed.success) return { ok: true, value: parsed.data };
  return {
    ok: false,
    problem: parsed.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; "),
  };
}

/** Models sometimes wrap JSON in a ```json fence despite instructions; unwrap it before parsing. */
function stripCodeFence(text: string): string {
  const fenced = /^\s*```(?:json)?\s*([\s\S]*?)\s*```\s*$/.exec(text);
  return fenced ? fenced[1] : text;
}
