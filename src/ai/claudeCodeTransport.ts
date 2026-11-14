import { spawn } from "node:child_process";
import { z } from "zod";
import { EFFORT, MODEL } from "./limits";
import type { Transport, TransportResponse } from "./types";

/** The fields of `claude -p --output-format json` that the client reads. */
const ClaudeCodeResultSchema = z.object({
  is_error: z.boolean().optional(),
  result: z.string().optional(),
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

/**
 * Claude Code backend: headless `claude -p` on the operator's own subscription.
 * One turn, no tools, our system text replacing Claude Code's, no session saved,
 * no user settings or skills loaded, so the answer depends only on our prompt.
 * The prompt goes over stdin (Windows limits command lines to about 32,000 characters).
 * Cost is whatever Claude Code reports. Spec section 6.
 */
export const claudeCodeTransport: Transport = async (
  { system, prompt, schema },
  signal,
) => {
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
    "--setting-sources",
    "",
  ];
  const stdout = await runClaude(args, prompt, signal);
  return parseClaudeCodeOutput(stdout);
};

/** Claude Code's validator has no copy of the draft 2020-12 meta-schema, so the `$schema` key must go. */
function toCliJsonSchema(schema: z.ZodType): object {
  const jsonSchema: Record<string, unknown> = z.toJSONSchema(schema);
  delete jsonSchema.$schema;
  return jsonSchema;
}

/** Turns Claude Code's JSON envelope into a transport response. Exported for tests. */
export function parseClaudeCodeOutput(stdout: string): TransportResponse {
  const parsed = ClaudeCodeResultSchema.safeParse(JSON.parse(stdout));
  if (!parsed.success) {
    throw new Error(
      `Claude Code returned JSON in an unexpected shape: ${z.prettifyError(parsed.error)}. ` +
        `Update Claude Code (claude update) and run the step again.`,
    );
  }
  const { is_error, result, stop_reason, total_cost_usd, usage } = parsed.data;
  const isRefusal = stop_reason === "refusal";
  if (is_error && !isRefusal) {
    throw new Error(
      `Claude Code reported an error: ${result ?? "no message"}. ` +
        `Run claude in a terminal to check you are logged in, then run the step again.`,
    );
  }
  return {
    text: result ?? "",
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

function runClaude(
  args: string[],
  stdin: string,
  signal: AbortSignal,
): Promise<string> {
  return new Promise((resolve, reject) => {
    // CLAUDE_CODE_EFFORT_LEVEL is how headless mode takes effort (spec section 6).
    const child = spawn("claude", args, {
      env: { ...process.env, CLAUDE_CODE_EFFORT_LEVEL: EFFORT },
      signal,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => (stdout += chunk));
    child.stderr.on("data", (chunk: Buffer) => (stderr += chunk));
    child.on("error", (error) => {
      const missing = (error as NodeJS.ErrnoException).code === "ENOENT";
      reject(
        missing
          ? new Error(
              "The claude command was not found. Install Claude Code, or set AI_BACKEND=api with ANTHROPIC_API_KEY.",
            )
          : error,
      );
    });
    child.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else
        reject(
          new Error(
            `claude exited with code ${code}: ${stderr.trim() || stdout.trim()}`,
          ),
        );
    });
    child.stdin.end(stdin);
  });
}
