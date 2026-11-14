import { runGit } from "@/lib/git/runGit";
import { CommandError, notesRef } from "./context";

/** One note in `refs/notes/countersign`: the blob that holds it and the commit it annotates. */
export type NoteEntry = { noteBlob: string; annotated: string };

/** Runs git and turns a missing git binary into an instruction instead of a stack trace. */
async function git(repoDir: string, args: string[]): Promise<Buffer> {
  try {
    return await runGit(repoDir, args);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("ENOENT")) {
      throw new CommandError(1, "git not found: install Git or put git on PATH.");
    }
    throw new CommandError(1, message);
  }
}

/** Lists every receipt note: `git notes --ref=countersign list` prints "<noteBlob> <annotatedCommit>" per line. */
export async function listNotes(repoDir: string): Promise<NoteEntry[]> {
  const output = (await git(repoDir, ["notes", `--ref=${notesRef}`, "list"])).toString("utf8");
  return output
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => {
      const [noteBlob, annotated] = line.trim().split(/\s+/);
      return { noteBlob, annotated };
    });
}

/** Reads a note's exact bytes from its blob, so the payload is verified as it was signed. */
export function readNote(repoDir: string, entry: NoteEntry): Promise<Buffer> {
  return git(repoDir, ["cat-file", "blob", entry.noteBlob]);
}

/** Whether `commit` already carries a receipt note. */
export async function hasNote(repoDir: string, commit: string): Promise<boolean> {
  return (await listNotes(repoDir)).some((entry) => entry.annotated === commit);
}

/**
 * Attaches the file's bytes as a note on `commit`. `--no-stripspace` keeps the
 * payload byte for byte; without it git would trim trailing blank lines.
 * Fails if a note exists: receipts are append-only.
 */
export async function addNote(repoDir: string, noteFile: string, commit: string): Promise<void> {
  await git(repoDir, ["notes", `--ref=${notesRef}`, "add", "--no-stripspace", "-F", noteFile, commit]);
}
