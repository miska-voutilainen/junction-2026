/**
 * Recordings: every accepted model answer is saved raw under data/recordings/ so demos,
 * tests and evals replay identical output without a model call. The model has no
 * temperature, so repeatability comes from these files, not from sampling.
 * Spec section 6, "Recording key".
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { MODEL, RECORDING_KEY_FILE_CHARS } from "./limits";

/** The saved form of one call: the model's raw text and what it cost. Replay validates it again. */
export const RecordingSchema = z.object({
  model: z.string(),
  promptVersion: z.string(),
  runIndex: z.number().int().nonnegative(),
  rawAnswer: z.string(),
  usage: z.object({
    inputTokens: z.number(),
    outputTokens: z.number(),
    costUsd: z.number().optional(),
  }),
});
export type Recording = z.infer<typeof RecordingSchema>;

/**
 * sha256 of model + prompt version + rendered prompt + run index (spec section 6).
 * The system text is not part of the key: it ships with the prompt version, so a change
 * to it bumps the version and with it the key.
 */
export function recordingKey(
  promptVersion: string,
  prompt: string,
  runIndex: number,
): string {
  const hash = createHash("sha256");
  // The separator keeps ("a1", "2x") apart from ("a12", "x").
  for (const part of [MODEL, promptVersion, prompt, String(runIndex)])
    hash.update(part).update("\0");
  return hash.digest("hex");
}

/** Path of a recording, e.g. data/recordings/a2.v1-3f9c01d2a4b8e6f7.json. */
export function recordingPath(
  directory: string,
  promptVersion: string,
  key: string,
): string {
  return path.join(
    directory,
    `${promptVersion}-${key.slice(0, RECORDING_KEY_FILE_CHARS)}.json`,
  );
}

/**
 * Reads a recording, or returns undefined when the file does not exist.
 *
 * @throws if the file exists but is not a recording (the zod message names the field).
 */
export async function readRecording(
  file: string,
): Promise<Recording | undefined> {
  let text: string;
  try {
    text = await readFile(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
  return RecordingSchema.parse(JSON.parse(text));
}

/** Writes a recording as indented JSON so diffs in review stay readable. */
export async function writeRecording(
  file: string,
  recording: Recording,
): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(recording, null, 2)}\n`, "utf8");
}
