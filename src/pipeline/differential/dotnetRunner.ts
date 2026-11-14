/**
 * Runs `dotnet restore` and `dotnet test` for A5 inside Docker, and says what
 * happened: the tests passed, a test failed, or nothing could be said (the code
 * did not build, no test matched the filter, the run timed out). "Could not say"
 * is its own result because a build error on the base says nothing about the
 * behaviour; counting it as a failed test would hand out Verified for free.
 * Spec section 6, A5.
 *
 * The test file is model-written C# that runs with the operator's rights, so the
 * two phases are split. (1) Restore runs the repository's own MSBuild with the
 * network, before any model-written file is in the worktree. (2) The test runs
 * with `--network none`, as a non-root user, with only that side's worktree
 * (read-write) and a NuGet cache volume (read-only) mounted: no host home, no
 * host environment, no other folder. What is not contained: the test can burn
 * CPU until the timeout, and a container escape is out of scope (docs/decisions.md).
 * There is no fallback: without Docker the step stops, it never runs on the host.
 */
import { execFile, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  CONTAINER_USER,
  DOTNET_SDK_IMAGE,
  NUGET_VOLUME,
  TEST_RUN_TIMEOUT_MS,
} from "../../policy/differentialTests";
import {
  classifyTestOutput,
  parseMethodResults,
  trimOutput,
  withoutTimings,
  withoutWorktreePath,
  type MethodResult,
  type RunResult,
} from "./testOutput";

/** What one test run says about the tested version. */
export interface TestRun {
  /** "error": nothing can be said about the behaviour (build error, no matching test, timeout). */
  result: RunResult;
  /**
   * The result of each requested test method. Optional so a runner that only
   * knows the overall result still works: every method then takes that result.
   */
  methods?: Record<string, MethodResult>;
  /** The end of the run's output, without build noise, timings and the worktree path. */
  output: string;
}

/** One worktree and the test project in it. */
export interface RestoreRequest {
  /** Absolute path of the worktree. */
  worktreeDir: string;
  /** Repository-relative project folder, forward slashes. */
  projectDir: string;
  /**
   * One of the repository's own tests. Roslyn analyzer tests download their
   * reference assemblies at run time, which the network-free test phase cannot do,
   * so this test runs once with the network, before any model-written file exists,
   * to fill the cache volume.
   */
  warmupTestName?: string;
}

/** One `dotnet test` call: where, which project, which tests. */
export interface TestRunRequest extends Omit<RestoreRequest, "warmupTestName"> {
  /** Test names; the run keeps the tests whose full name contains any of them. */
  testNames: readonly string[];
}

/** What the A5 step needs from .NET. Tests supply a fake; production uses `dockerDotnetRunner`. */
export interface DotnetRunner {
  /** Fails early, before any model call, when the runner cannot work. @throws Error with what to do. */
  ensureReady(): Promise<void>;
  /** Restores the project's packages, with the network and before any model-written file exists. @throws Error when it fails. */
  restore(request: RestoreRequest): Promise<void>;
  /** Builds and runs the matching tests without network. */
  test(request: TestRunRequest): Promise<TestRun>;
}

/** Where the worktree is mounted inside the container. */
const CONTAINER_WORKTREE = "/work";

/** Where the NuGet volume is mounted inside the container. */
const CONTAINER_NUGET = "/nuget";

/** Settings every container gets: nothing from the host's environment but these, and no extra privileges. */
function commonArguments(name: string, worktreeDir: string, nugetMode: "rw" | "ro"): string[] {
  return [
    "run",
    "--rm",
    "--name",
    name,
    "--user",
    CONTAINER_USER,
    "--cap-drop",
    "ALL",
    "--security-opt",
    "no-new-privileges",
    "-v",
    `${worktreeDir.replaceAll("\\", "/")}:${CONTAINER_WORKTREE}`,
    "-v",
    `${NUGET_VOLUME}:${CONTAINER_NUGET}:${nugetMode}`,
    "-w",
    CONTAINER_WORKTREE,
    "-e",
    "DOTNET_NOLOGO=1",
    "-e",
    "DOTNET_CLI_TELEMETRY_OPTOUT=1",
    "-e",
    `NUGET_PACKAGES=${CONTAINER_NUGET}`,
    // The app user has no home folder to write to.
    "-e",
    "HOME=/tmp",
    "-e",
    "DOTNET_CLI_HOME=/tmp",
  ];
}

/** Where the Roslyn testing library keeps the reference assemblies it downloads, relative to the temp folder. */
const REFERENCE_PACKAGES = "test-packages";

/**
 * The `docker run` arguments that run one of the repository's own tests with the
 * network, to download the reference assemblies the analyzer tests need into the
 * cache volume. The script is fixed; the project and the test name arrive as
 * positional arguments, never inside the script text.
 */
export function warmupArguments(name: string, request: RestoreRequest): string[] {
  const script = [
    `mkdir -p ${CONTAINER_NUGET}/${REFERENCE_PACKAGES}`,
    `cp -a ${CONTAINER_NUGET}/${REFERENCE_PACKAGES} /tmp/`,
    'dotnet test "$0" --no-restore --nologo --disable-build-servers --filter "$1" > /dev/null 2>&1',
    `cp -a /tmp/${REFERENCE_PACKAGES}/. ${CONTAINER_NUGET}/${REFERENCE_PACKAGES}/`,
  ].join("; ");
  return [
    ...commonArguments(name, request.worktreeDir, "rw"),
    DOTNET_SDK_IMAGE,
    "sh",
    "-c",
    script,
    request.projectDir,
    `FullyQualifiedName~${request.warmupTestName}`,
  ];
}

/** The `docker run` arguments of the restore phase: network on, no model-written file in the worktree yet. */
export function restoreArguments(name: string, request: RestoreRequest): string[] {
  return [
    ...commonArguments(name, request.worktreeDir, "rw"),
    DOTNET_SDK_IMAGE,
    "dotnet",
    "restore",
    request.projectDir,
    "--nologo",
  ];
}

/**
 * The `docker run` arguments of the test phase: no network, no restore, the NuGet
 * cache read-only. The filter is a `~` match of any name, so a name never needs quoting.
 */
export function testArguments(name: string, request: TestRunRequest): string[] {
  const filter = request.testNames.map((testName) => `FullyQualifiedName~${testName}`).join("|");
  return [
    ...commonArguments(name, request.worktreeDir, "ro"),
    "--network",
    "none",
    DOTNET_SDK_IMAGE,
    // Copy the cached reference assemblies to the temp folder, where the testing library looks for them.
    "sh",
    "-c",
    `cp -a ${CONTAINER_NUGET}/${REFERENCE_PACKAGES} /tmp/ 2>/dev/null; exec dotnet "$@"`,
    "sh",
    "test",
    request.projectDir,
    "--no-restore",
    "--nologo",
    "--disable-build-servers",
    "--logger",
    "console;verbosity=normal",
    "--filter",
    filter,
  ];
}

/** The real runner: Docker. */
export const dockerDotnetRunner: DotnetRunner = {
  async ensureReady() {
    const info = await runDocker(["info", "--format", "{{.ServerVersion}}"], 30_000);
    if (info.exitCode !== 0)
      throw new Error("Docker is not running. Start Docker Desktop, or run with --no-tests.");
    // The volume is created root-owned; the container user needs to write the restored packages into it.
    await runDocker(["volume", "create", NUGET_VOLUME], 30_000);
    const chown = await runDocker(
      [
        "run",
        "--rm",
        "--user",
        "root",
        "-v",
        `${NUGET_VOLUME}:${CONTAINER_NUGET}`,
        DOTNET_SDK_IMAGE,
        "chown",
        CONTAINER_USER,
        CONTAINER_NUGET,
      ],
      TEST_RUN_TIMEOUT_MS,
    );
    if (chown.exitCode !== 0)
      throw new Error(
        `Could not prepare the NuGet cache volume ${NUGET_VOLUME} (pulling ${DOTNET_SDK_IMAGE} may have failed): ${tail(chown.output)}. Check the network and Docker, or run with --no-tests.`,
      );
  },

  async restore(request) {
    const name = containerName();
    const result = await runDocker(restoreArguments(name, request), TEST_RUN_TIMEOUT_MS, name);
    if (result.exitCode !== 0 || result.isTimeout)
      throw new Error(
        `dotnet restore failed in ${request.projectDir} (${result.isTimeout ? "timed out" : `exit ${result.exitCode}`}): ${tail(result.output)}. Check the network, or run with --no-tests.`,
      );
    if (request.warmupTestName !== undefined) {
      // A failing warm-up is not an error: the test may fail for its own reasons, and the cache fills as far as it ran.
      const warmup = containerName();
      await runDocker(warmupArguments(warmup, request), TEST_RUN_TIMEOUT_MS, warmup);
    }
  },

  async test(request) {
    const name = containerName();
    const {
      output: rawOutput,
      exitCode,
      isTimeout,
    } = await runDocker(testArguments(name, request), TEST_RUN_TIMEOUT_MS, name);
    const methods = parseMethodResults(rawOutput, request.testNames);
    const output = withoutTimings(withoutWorktreePath(rawOutput, CONTAINER_WORKTREE));
    if (isTimeout)
      return {
        result: "error",
        methods,
        output: trimOutput(`${output}\nTimed out after ${TEST_RUN_TIMEOUT_MS / 60_000} minutes.`),
      };
    return { result: classifyTestOutput(output, exitCode), methods, output: trimOutput(output) };
  },
};

/** A name per container, so the timeout can kill exactly this one. */
function containerName(): string {
  return `countersign-a5-${randomBytes(6).toString("hex")}`;
}

function tail(output: string): string {
  return output.trim().split(/\r?\n/).slice(-3).join(" | ").slice(-400);
}

interface ProcessResult {
  output: string;
  exitCode: number | null;
  isTimeout: boolean;
}

/**
 * Runs `docker <args>` without a shell. On a timeout the named container is
 * killed: killing the `docker` client alone would leave the container running.
 */
function runDocker(
  args: string[],
  timeoutMs: number,
  containerToKill?: string,
): Promise<ProcessResult> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    const child = spawn("docker", args, { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    let isTimeout = false;
    const timer = setTimeout(() => {
      isTimeout = true;
      if (containerToKill !== undefined)
        execFile("docker", ["kill", containerToKill], () => undefined);
      child.kill();
    }, timeoutMs);
    const collect = (chunk: Buffer) => chunks.push(chunk);
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    const finish = (exitCode: number | null, extra = "") => {
      clearTimeout(timer);
      resolve({ output: Buffer.concat(chunks).toString("utf8") + extra, exitCode, isTimeout });
    };
    child.on("error", (error) => finish(null, `\nCould not start docker: ${error.message}`));
    child.on("close", (exitCode) => finish(exitCode));
  });
}
