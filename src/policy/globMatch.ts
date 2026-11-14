/**
 * Path globs for policy rules. Written without a dependency because route()
 * runs in the browser as well as in the pipeline, and the policy files stay
 * plain data a reviewer can read.
 */

/**
 * Turns a glob into an anchored RegExp. A double star crosses folders, a
 * single star stays inside one name: "**" + "/AnalyzerReleases.*.md" matches
 * "src/X/AnalyzerReleases.Shipped.md" and "AnalyzerReleases.Shipped.md".
 */
export function globToRegExp(glob: string): RegExp {
  const pattern = glob
    .replace(/[.+^${}()|[\]\\]/g, String.raw`\$&`)
    .replace(/\*\*\//g, "<anyFolders>")
    .replace(/\*\*/g, "<anything>")
    .replace(/\*/g, "[^/]*")
    .replace(/<anyFolders>/g, "(?:.*/)?")
    .replace(/<anything>/g, ".*");
  return new RegExp(`^${pattern}$`);
}

/** True when the repo-relative path (forward slashes) matches the glob. */
export function matchesGlob(glob: string, path: string): boolean {
  return globToRegExp(glob).test(path);
}
