/**
 * The repository at the base commit, as the legacy guard reads it: what a path
 * mentions, which files exist and what a csproj says. Everything here predates
 * the change under review, so the agent that wrote the change did not write it.
 * Read through git only; nothing is checked out.
 */
import { readFileAtCommit } from "./readFileAtCommit";
import { runGit } from "./runGit";

/** What the detectors read from the base commit; a test passes a fake. */
export interface BaseTree {
  /** Paths under the pathspecs whose text contains the whole word. */
  filesMentioning(word: string, pathspecs: string[]): Promise<string[]>;
  /** Lines under the pathspecs that have an access modifier (a declaration candidate), with their file. */
  accessModifierLines(pathspecs: string[]): Promise<Array<{ path: string; text: string }>>;
  /** The file at the base commit, or null. */
  readFile(path: string): Promise<string | null>;
  /** Every path under a folder at the base commit. */
  listFiles(folder: string): Promise<string[]>;
}

/**
 * The base commit of a repository, read with git.
 * @throws Error when git fails for a reason other than "no match".
 */
export function gitBaseTree(repoDir: string, baseSha: string): BaseTree {
  const git = async (args: string[]) =>
    (await runGit(repoDir, args, { isolated: true })).toString();
  // `git grep` exits 1 when nothing matches; node reports that as "Command failed" with no git
  // stderr, which is the one failure that means "no result" and not "broken repository".
  const grep = async (args: string[], pathspecs: string[]): Promise<string[]> => {
    try {
      return (await git(["grep", ...args, baseSha, "--", ...pathspecs]))
        .split("\n")
        .filter(Boolean);
    } catch (error) {
      if (error instanceof Error && error.message.includes("Command failed")) return [];
      throw error;
    }
  };
  // Lines look like "<sha>:<path>:<text>"; paths hold no colon.
  const withoutSha = (line: string) => line.slice(baseSha.length + 1);
  return {
    filesMentioning: async (word, pathspecs) =>
      (await grep(["-l", "-w", "-I", "-e", word], pathspecs)).map(withoutSha),
    accessModifierLines: async (pathspecs) =>
      (
        await grep(["-I", "-E", "-e", "(public|internal|protected|private)[[:space:]]"], pathspecs)
      ).map((line) => {
        const [path, ...text] = withoutSha(line).split(":");
        return { path, text: text.join(":") };
      }),
    readFile: (path) => readFileAtCommit(repoDir, baseSha, path),
    listFiles: async (folder) =>
      (await git(["ls-tree", "-r", "--name-only", baseSha, "--", folder]))
        .split("\n")
        .filter(Boolean),
  };
}
