import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { appendLessonsEntry, localTimestamp } from "./lessonsLog";

const now = new Date(2026, 10, 14, 9, 5);
const newLogFile = () => join(mkdtempSync(join(tmpdir(), "lessons-")), "lessons.md");

describe("appendLessonsEntry", () => {
  it("creates the log with its heading and a dated entry", async () => {
    const file = newLogFile();
    const added = await appendLessonsEntry(file, {
      title: "Anchored versus blind-first",
      text: "No-go: x.",
      now,
    });
    expect(added).toBe(true);
    expect(readFileSync(file, "utf8")).toBe(
      "# Lessons log\n\n## 2026-11-14 09:05 · Anchored versus blind-first\n\nNo-go: x.\n",
    );
  });

  it("appends to an existing log and skips an entry whose text is already there", async () => {
    const file = newLogFile();
    writeFileSync(file, "# Lessons log\n\n## 2026-11-13 20:00 · Earlier\n\nSomething.\n");
    await appendLessonsEntry(file, { title: "T", text: "Same line.", now });
    expect(await appendLessonsEntry(file, { title: "T", text: "Same line.", now })).toBe(false);
    const text = readFileSync(file, "utf8");
    expect(text).toContain("## 2026-11-13 20:00 · Earlier");
    expect(text.match(/Same line\./g)).toHaveLength(1);
  });

  it("formats the timestamp with zero padding", () => {
    expect(localTimestamp(now)).toBe("2026-11-14 09:05");
  });
});
