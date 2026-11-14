/**
 * Recordings: every model answer is saved under data/recordings/ so demos, tests and
 * evals replay byte-identical output without a model call. The model has no
 * temperature, so repeatability comes from these files, not from sampling.
 * Spec section 6, "Recording key".
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { MODEL, RECORDING_KEY_FILE_CHARS } from "./limits";
import type { Usage } from "./types";

/** The saved form of one call: the validated answer and what it cost. */
export interface Recording {
  model: string;
  promptVersion: string;
  runIndex: number;
  answer: unknown;
  usage: Usage;
}

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

/** Reads a recording, or returns undefined when the file does not exist. */
export async function readRecording(
  file: string,
): Promise<Recording | undefined> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as Recording;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

/** Writes a recording as indented JSON so diffs in review stay readable. */
export async function writeRecording(
  file: string,
  recording: Recording,
): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(recording, null, 2)}\n`, "utf8");
}
