/**
 * Runs `dotnet test` on one worktree and says what happened: the tests passed,
 * a test failed, or nothing could be said (the code did not build, no test
 * matched the filter, the run timed out). "Could not say" is its own result
 * because a build error on the base says nothing about the behaviour; counting
 * it as a failed test would hand out Verified for free. Spec section 6, A5.
 *
 * Model-written C# runs here, so: only inside a temporary worktree, started with
 * an argument list and no shell, with a small allow-listed environment (no API
 * keys), and the whole process tree is killed on a timeout.
 */
import { spawn, execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { TEST_OUTPUT_MAX_CHARS, TEST_RUN_TIMEOUT_MS } from "../../policy/differentialTests";

/** What one test run says about the tested version. */
export interface TestRun {
  /** "error": nothing can be said about the behaviour (build error, no matching test, timeout). */
  result: "pass" | "fail" | "error";
  /** The last TEST_OUTPUT_MAX_CHARS characters of the run's output. */
  output: string;
}

/** One `dotnet test` call: where, which project, which tests. */
export interface TestRunRequest {
  /** Absolute path of the worktree. */
  worktreeDir: string;
  /** Repository-relative project folder, forward slashes. */
  projectDir: string;
  /** Test names; the run keeps the tests whose full name contains any of them. */
  testNames: readonly string[];
}

/** Runs the tests of one request. Tests supply a fake; production uses `runDotnetTest`. */
export type DotnetRunner = (request: TestRunRequest) => Promise<TestRun>;

/** Where the .NET SDK installs on Windows when it is not on the PATH. */
const windowsDotnetDir = "C:\\Program Files\\dotnet";

/**
 * Environment variables a build needs, lower case; everything else (API keys,
 * tokens) stays out of model-written code's reach. Matched case-insensitively
 * because Windows spells it `Path` and POSIX `PATH`.
 */
const inheritedVariables = new Set([
  "path",
  "systemroot",
  "windir",
  "temp",
  "tmp",
  "tmpdir",
  "home",
  "userprofile",
  "appdata",
  "localappdata",
  "programfiles",
  "programfiles(x86)",
  "programdata",
  "programw6432",
  "comspec",
  "pathext",
  "dotnet_root",
  "nuget_packages",
]);

/** The environment `dotnet` runs with. */
export function dotnetEnvironment(
  source: Record<string, string | undefined> = process.env,
): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [name, value] of Object.entries(source)) {
    if (value !== undefined && inheritedVariables.has(name.toLowerCase())) env[name] = value;
  }
  const pathName = Object.keys(env).find((name) => name.toLowerCase() === "path") ?? "PATH";
  if (process.platform === "win32" && existsSync(windowsDotnetDir))
    env[pathName] = `${env[pathName] ?? ""};${windowsDotnetDir}`;
  return {
    ...env,
    DOTNET_NOLOGO: "1",
    DOTNET_CLI_TELEMETRY_OPTOUT: "1",
    DOTNET_SKIP_FIRST_TIME_EXPERIENCE: "1",
  };
}

/** The `dotnet test` arguments for a request. The filter is a `~` match of any name, so a name never needs quoting. */
export function dotnetTestArguments({ projectDir, testNames }: TestRunRequest): string[] {
  const filter = testNames.map((name) => `FullyQualifiedName~${name}`).join("|");
  return ["test", projectDir, "--nologo", "--filter", filter];
}

/**
 * Runs `dotnet test` with the real SDK.
 *
 * @example runDotnetTest({ worktreeDir, projectDir: "tests/X.Tests", testNames: ["A5_F1_Works"] })
 *   // { result: "fail", output: "...Failed A5_F1_Works [12 ms]..." }
 */
export const runDotnetTest: DotnetRunner = async (request) => {
  const { output, exitCode, isTimeout } = await runProcess(request);
  if (isTimeout)
    return {
      result: "error",
      output: trimOutput(`${output}\nTimed out after ${TEST_RUN_TIMEOUT_MS / 60_000} minutes.`),
    };
  return { result: classifyTestOutput(output, exitCode), output: trimOutput(output) };
};

/**
 * Reads a `dotnet test` run. Build errors and "no test matches the filter" come
 * first: both can come with a zero or non-zero exit code and neither is a verdict
 * on the code.
 */
export function classifyTestOutput(output: string, exitCode: number | null): TestRun["result"] {
  // Not "Build FAILED": dotnet prints that after a failed test too.
  if (/error (CS|MSB|NU|NETSDK)\d+/.test(output)) return "error";
  if (/No test matches the given testcase filter|No test is available/.test(output)) return "error";
  // One summary line per target framework: "Passed!  - Failed:     0, Passed:     2, Skipped:     0, Total:     2".
  const summaries = [...output.matchAll(/Failed: +(\d+), Passed: +(\d+)/g)];
  if (summaries.length === 0) return "error";
  const failed = summaries.reduce((sum, match) => sum + Number(match[1]), 0);
  const passed = summaries.reduce((sum, match) => sum + Number(match[2]), 0);
  if (failed > 0) return "fail";
  return exitCode === 0 && passed > 0 ? "pass" : "error";
}

/** Restore and build progress and warnings: a successful build prints hundreds of lines, and they would push the failure out of the kept tail. */
const buildNoise = /: warning |^\s+Restored |Determining projects|^\s+\S+ -> /;

/** Keeps the end of the output, where the failure and the summary line are, without the build noise before it. */
export function trimOutput(output: string): string {
  const text = output
    .split(/\r?\n/)
    .filter((line) => !buildNoise.test(line))
    .join("\n")
    .trim();
  return text.length <= TEST_OUTPUT_MAX_CHARS ? text : text.slice(-TEST_OUTPUT_MAX_CHARS);
}

interface ProcessResult {
  output: string;
  exitCode: number | null;
  isTimeout: boolean;
}

function runProcess(request: TestRunRequest): Promise<ProcessResult> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    // A new process group on POSIX lets the timeout kill the test host and the build servers with `dotnet`.
    const child = spawn("dotnet", dotnetTestArguments(request), {
      cwd: request.worktreeDir,
      env: dotnetEnvironment() as NodeJS.ProcessEnv,
      stdio: ["ignore", "pipe", "pipe"],
      detached: process.platform !== "win32",
      windowsHide: true,
    });
    let isTimeout = false;
    const timer = setTimeout(() => {
      isTimeout = true;
      killProcessTree(child.pid);
    }, TEST_RUN_TIMEOUT_MS);
    const collect = (chunk: Buffer) => chunks.push(chunk);
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    const finish = (exitCode: number | null, extra = "") => {
      clearTimeout(timer);
      resolve({ output: Buffer.concat(chunks).toString("utf8") + extra, exitCode, isTimeout });
    };
    child.on("error", (error) => finish(null, `\nCould not start dotnet: ${error.message}`));
    child.on("close", (exitCode) => finish(exitCode));
  });
}

function killProcessTree(pid: number | undefined): void {
  if (pid === undefined) return;
  if (process.platform === "win32") {
    // /T kills the children too: the test host outlives the CLI otherwise.
    execFile("taskkill", ["/pid", String(pid), "/T", "/F"], () => undefined);
    return;
  }
  try {
    process.kill(-pid, "SIGKILL");
  } catch {
    // The group is already gone: the run ended between the timer and the kill.
  }
}
