import { existsSync } from "node:fs";
import { appendFile, readFile, writeFile } from "node:fs/promises";

const LOG_HEADING = "# Lessons log\n";

/**
 * Adds a dated entry to the lessons log, creating the file with its heading
 * when it is missing. An entry is "## YYYY-MM-DD HH:mm · <title>" and what happened.
 *
 * @returns false when the log already holds this exact text, so re-scoring
 * unchanged runs doesn't add a second identical entry.
 */
export async function appendLessonsEntry(
  file: string,
  entry: { title: string; text: string; now: Date },
): Promise<boolean> {
  if (!existsSync(file)) await writeFile(file, LOG_HEADING);
  if ((await readFile(file, "utf8")).includes(entry.text)) return false;
  await appendFile(file, `\n## ${localTimestamp(entry.now)} · ${entry.title}\n\n${entry.text}\n`);
  return true;
}

/** "2026-11-14 09:30" in the machine's time zone, the format the log's headings use. */
export function localTimestamp(date: Date): string {
  const two = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())} ${two(date.getHours())}:${two(date.getMinutes())}`;
}
