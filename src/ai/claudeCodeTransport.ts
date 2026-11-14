import { spawn } from "node:child_process";
import os from "node:os";
import { z } from "zod";
import {
  CLI_ARGUMENT_LIMIT_CHARS,
  EFFORT,
  ERROR_EXCERPT_CHARS,
  MODEL,
} from "./limits";
import type { Transport, TransportResponse } from "./types";

/** The fields of `claude -p --output-format json` that the client reads. */
const ClaudeCodeResultSchema = z.object({
  is_error: z.boolean().optional(),
  result: z.string().optional(),
  // With --json-schema the object arrives here and `result` may be prose.
  structured_output: z.unknown().optional(),
  stop_reason: z.string().nullish(),
  total_cost_usd: z.number().optional(),
  usage: z
    .object({
      input_tokens: z.number().optional(),
      output_tokens: z.number().optional(),
      // Cache tokens are reported apart from input_tokens; the sum is the real prompt size.
      cache_creation_input_tokens: z.number().optional(),
      cache_read_input_tokens: z.number().optional(),
    })
    .optional(),
});

/** Environment variables that would make Claude Code bill an API key instead of the subscription. */
const BILLING_ENV_VARIABLES = ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN"];

/**
 * Claude Code backend: headless `claude -p` on the operator's own subscription.
 * One turn, no tools, our system text replacing Claude Code's, no session saved,
 * no user settings, skills or MCP servers loaded, so the answer depends only on our prompt.
 * The prompt goes over stdin; the system text and schema are arguments (no
 * `--system-prompt-file` exists), so their size is guarded. Cost is what Claude Code reports.
 * Spec section 6.
 */
export const claudeCodeTransport: Transport = async (
  { system, prompt, schema },
  signal,
) => {
  const args = buildArguments(system, schema);
  const result = await runClaude(args, prompt, signal);
  return toTransportResult(result.code, result.stdout, result.stderr);
};

/** The `claude` arguments for one call. @throws if they would exceed the command-line limit. */
function buildArguments(system: string, schema: z.ZodType): string[] {
  const args = [
    "-p",
    "--output-format",
    "json",
    "--model",
    MODEL,
    "--tools",
    "",
    "--system-prompt",
    system,
    "--json-schema",
    JSON.stringify(toCliJsonSchema(schema)),
    "--no-session-persistence",
    "--disable-slash-commands",
    "--strict-mcp-config",
    "--setting-sources",
    "",
  ];
  const length = args.reduce((sum, arg) => sum + arg.length + 1, 0);
  if (length > CLI_ARGUMENT_LIMIT_CHARS) {
    throw new Error(
      `The system text and schema make a ${length} character command line; Windows allows about ` +
        `${CLI_ARGUMENT_LIMIT_CHARS}. Shorten the prompt's system text, or use AI_BACKEND=api.`,
    );
  }
  return args;
}

/** Claude Code's validator has no copy of the draft 2020-12 meta-schema, so the `$schema` key must go. */
function toCliJsonSchema(schema: z.ZodType): object {
  const jsonSchema: Record<string, unknown> = z.toJSONSchema(schema);
  delete jsonSchema.$schema;
  return jsonSchema;
}

/**
 * Turns the process result into a transport response. Claude Code exits non-zero with a
 * JSON envelope for "not logged in" and API errors, so the envelope is read first whatever
 * the exit code; the exit code and stderr are the fallback when stdout is not an envelope.
 *
 * @throws with what Claude Code said and what to do next.
 */
export function toTransportResult(
  code: number | null,
  stdout: string,
  stderr: string,
): TransportResponse {
  let envelope: unknown;
  try {
    envelope = JSON.parse(stdout);
  } catch {
    const excerpt = (stderr.trim() || stdout.trim()).slice(
      0,
      ERROR_EXCERPT_CHARS,
    );
    throw new Error(
      `claude exited with code ${code} and printed no JSON result: "${excerpt}". ` +
        `Run claude in a terminal to check it works and you are logged in, then run the step again.`,
    );
  }
  return readEnvelope(envelope);
}

function readEnvelope(envelope: unknown): TransportResponse {
  const parsed = ClaudeCodeResultSchema.safeParse(envelope);
  if (!parsed.success) {
    throw new Error(
      `Claude Code returned JSON in an unexpected shape: ${z.prettifyError(parsed.error)}. ` +
        `Update Claude Code (claude update) and run the step again.`,
    );
  }
  const {
    is_error,
    result,
    structured_output,
    stop_reason,
    total_cost_usd,
    usage,
  } = parsed.data;
  const isRefusal = stop_reason === "refusal";
  if (is_error && !isRefusal) {
    throw new Error(
      `Claude Code reported an error: ${result ?? "no message"}. ` +
        `Run claude in a terminal to check you are logged in, then run the step again.`,
    );
  }
  return {
    text:
      structured_output !== undefined
        ? JSON.stringify(structured_output)
        : (result ?? ""),
    model: MODEL,
    isRefusal,
    usage: {
      inputTokens:
        (usage?.input_tokens ?? 0) +
        (usage?.cache_creation_input_tokens ?? 0) +
        (usage?.cache_read_input_tokens ?? 0),
      outputTokens: usage?.output_tokens ?? 0,
      costUsd: total_cost_usd,
    },
  };
}

interface ProcessResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

function runClaude(
  args: string[],
  stdin: string,
  signal: AbortSignal,
): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    // Never `shell: true`: the system text is an argument, and a shell would interpret it.
    const child = spawn("claude", args, {
      env: claudeEnvironment(),
      // A neutral folder, so no project CLAUDE.md or .mcp.json is loaded: the blind review
      // must not see this repository's notes (they mention the planted bugs).
      cwd: os.tmpdir(),
      signal,
      stdio: ["pipe", "pipe", "pipe"],
    });
    // Decode as a stream: a multi-byte character split across chunks would corrupt quotes
    // that the quote check later matches exactly.
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: string) => (stdout += chunk));
    child.stderr.on("data", (chunk: string) => (stderr += chunk));
    child.on("error", (error) => reject(explainSpawnError(error)));
    child.on("close", (code) => resolve({ code, stdout, stderr }));
    // If claude exits before reading stdin, the write fails with EPIPE; the close event then
    // reports the exit code and stderr, which is the useful error. Any other failure is real.
    child.stdin.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code !== "EPIPE") reject(error);
    });
    child.stdin.end(stdin);
  });
}

/** Our environment minus the variables that switch Claude Code from the subscription to API billing. */
function claudeEnvironment(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    CLAUDE_CODE_EFFORT_LEVEL: EFFORT,
  };
  for (const name of BILLING_ENV_VARIABLES) delete env[name];
  return env;
}

function explainSpawnError(error: Error): Error {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") return error;
  return new Error(
    "The claude command was not found. Install Claude Code with its native installer " +
      "(an npm install makes claude.cmd, which cannot be started without a shell), " +
      "or set AI_BACKEND=api with ANTHROPIC_API_KEY.",
  );
}
