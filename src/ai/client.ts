/**
 * The one model client. Every review step calls the model here and nowhere else, so
 * validation, retry, refusal handling, recording and cost logging are written once.
 * A call is: render, ask, validate against the call's zod schema, retry once with the
 * validation error, record. In replay mode no model is called at all, which is what
 * lets the demo and the tests run offline on identical answers.
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
  RecordingStaleError,
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
  TransportResponse,
  Usage,
  UsageEntry,
} from "./types";
import { costOf, stderrUsageSink, type UsageSink } from "./usageLog";
import { validateAnswer } from "./validateAnswer";

/** Default recordings folder, relative to the repository root where the CLIs run. */
const DEFAULT_RECORDINGS_DIRECTORY = path.join("data", "recordings");

/** What a client needs. Production builds it from the environment; tests pass a fake transport. */
export interface ModelClientOptions {
  mode: AiMode;
  transport: Transport;
  recordingsDirectory?: string;
  usageSink?: UsageSink;
}

/** A request whose schema fixes the answer's type. */
export type TypedRequest<T> = ModelRequest & { schema: z.ZodType<T> };

/** The client's one operation: send a request, get a validated answer of the schema's type. */
export interface ModelClient {
  call<T>(request: TypedRequest<T>): Promise<T>;
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
    async call<T>(request: TypedRequest<T>): Promise<T> {
      const runIndex = request.runIndex ?? 0;
      const key = recordingKey(request.promptVersion, request.prompt, runIndex);
      const file = recordingPath(directory, request.promptVersion, key);

      if (options.mode === "replay") return replay(request, file, logUsage);

      const accepted = await askUntilValid(
        options.transport,
        request,
        logUsage,
      );
      if (options.mode === "record") {
        await writeRecording(file, {
          model: accepted.model,
          promptVersion: request.promptVersion,
          runIndex,
          rawAnswer: accepted.rawAnswer,
          usage: accepted.usage,
        });
      }
      return accepted.answer;
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
  request: TypedRequest<T>,
  file: string,
  logUsage: UsageSink,
): Promise<T> {
  const recording = await readRecording(file);
  if (!recording) throw new RecordingMissingError(request.promptVersion, file);
  // Same check as a fresh answer. A failure means the schema changed without a prompt version bump.
  const checked = validateAnswer(recording.rawAnswer, request.schema);
  if (!checked.ok) throw new RecordingStaleError(request.promptVersion, file);
  logUsage({
    model: recording.model,
    promptVersion: request.promptVersion,
    inputTokens: recording.usage.inputTokens,
    outputTokens: recording.usage.outputTokens,
    costUsd: costOf(recording.usage),
    milliseconds: 0,
    outcome: "ok",
    source: "replay",
  });
  return checked.value;
}

interface AcceptedAnswer<T> {
  answer: T;
  rawAnswer: string;
  model: string;
  /** Tokens and cost of every ask this call made, so a recording shows what the answer cost. */
  usage: Usage;
}

/**
 * Asks, validates, and on a schema failure asks once more with the error appended.
 * Every response is logged with its outcome, so refusals and rejected answers are counted too.
 */
async function askUntilValid<T>(
  transport: Transport,
  request: TypedRequest<T>,
  logUsage: UsageSink,
): Promise<AcceptedAnswer<T>> {
  let prompt = request.prompt;
  const total: Usage = { inputTokens: 0, outputTokens: 0, costUsd: 0 };
  let lastProblem = "";

  for (let attempt = 0; attempt <= MAX_VALIDATION_RETRIES; attempt++) {
    const startedAt = Date.now();
    const log = (outcome: UsageEntry["outcome"], model: string, usage: Usage) =>
      logUsage({
        model,
        promptVersion: request.promptVersion,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        costUsd: costOf(usage),
        milliseconds: Date.now() - startedAt,
        outcome,
        source: "model",
      });

    let response: TransportResponse;
    try {
      response = await askOnce(transport, request, prompt);
    } catch (error) {
      if (error instanceof ModelTimeoutError)
        log("timeout", MODEL, { inputTokens: 0, outputTokens: 0, costUsd: 0 });
      throw error;
    }
    total.inputTokens += response.usage.inputTokens;
    total.outputTokens += response.usage.outputTokens;
    total.costUsd = (total.costUsd ?? 0) + costOf(response.usage);

    if (response.isRefusal) {
      log("refusal", response.model, response.usage);
      throw new ModelRefusalError(request.promptVersion);
    }
    const checked = validateAnswer(response.text, request.schema);
    if (checked.ok) {
      log("ok", response.model, response.usage);
      return {
        answer: checked.value,
        rawAnswer: response.text,
        model: response.model,
        usage: total,
      };
    }

    log("invalid", response.model, response.usage);
    lastProblem = checked.problem;
    prompt =
      `${request.prompt}\n\nYour previous answer was rejected: ${checked.problem}\n` +
      `Answer again with only the corrected JSON.`;
  }
  throw new ModelValidationError(request.promptVersion, lastProblem);
}

/** One transport call under the per-request time budget. */
async function askOnce<T>(
  transport: Transport,
  request: TypedRequest<T>,
  prompt: string,
): Promise<TransportResponse> {
  const signal = AbortSignal.timeout(CALL_TIMEOUT_MS);
  try {
    return await transport(
      {
        promptVersion: request.promptVersion,
        system: request.system,
        prompt,
        schema: request.schema,
      },
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
