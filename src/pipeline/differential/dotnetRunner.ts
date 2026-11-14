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
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  CONTAINER_USER,
  DOTNET_SDK_IMAGE,
  NUGET_VOLUME,
  TEST_RUN_TIMEOUT_MS,
} from "../../policy/differentialTests";
import {
  CONTAINER_NUGET,
  CONTAINER_WORKTREE,
  restoreArguments,
  testArguments,
  warmupArguments,
  type RestoreRequest,
  type TestRunRequest,
} from "./dockerArguments";
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

/** What the A5 step needs from .NET. Tests supply a fake; production uses `dockerDotnetRunner`. */
export interface DotnetRunner {
  /** Fails early, before any model call, when the runner cannot work. @throws Error with what to do. */
  ensureReady(): Promise<void>;
  /** Restores the project's packages, with the network and before any model-written file exists. @throws Error when it fails. */
  restore(request: RestoreRequest): Promise<void>;
  /** Builds and runs the matching tests without network. */
  test(request: TestRunRequest): Promise<TestRun>;
}

/** Docker's own quick commands (server info, volume create) answer in well under this; longer means Docker is stuck. */
const QUICK_DOCKER_TIMEOUT_MS = 30_000;

const MS_PER_MINUTE = 60_000;

/** The real runner: Docker. */
export const dockerDotnetRunner: DotnetRunner = {
  async ensureReady() {
    const info = await runDocker(
      ["info", "--format", "{{.ServerVersion}}"],
      QUICK_DOCKER_TIMEOUT_MS,
    );
    if (info.exitCode !== 0)
      throw new Error("Docker is not running. Start Docker Desktop, or run with --no-tests.");
    // The volume is created root-owned; the container user needs to write the restored packages into it.
    await runDocker(["volume", "create", NUGET_VOLUME], QUICK_DOCKER_TIMEOUT_MS);
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
    const restoreOutcome = result.isTimeout ? "timed out" : "exit " + result.exitCode;
    if (result.exitCode !== 0 || result.isTimeout)
      throw new Error(
        `dotnet restore failed in ${request.projectDir} (${restoreOutcome}): ${tail(result.output)}. Check the network, or run with --no-tests.`,
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
        output: trimOutput(
          `${output}\nTimed out after ${TEST_RUN_TIMEOUT_MS / MS_PER_MINUTE} minutes.`,
        ),
      };
    return { result: classifyTestOutput(output, exitCode), methods, output: trimOutput(output) };
  },
};

/** A name per container, so the timeout can kill exactly this one. */
function containerName(): string {
  return `countersign-a5-${randomBytes(6).toString("hex")}`;
}

/** Lines of a failed command's output that an error message quotes: the last ones hold the cause. */
const ERROR_TAIL_LINES = 3;

/** Longest quote in an error message; a build log line can be very long. */
const ERROR_TAIL_MAX_CHARS = 400;

/**
 * The end of a command's output as one line, for an error message.
 *
 * @example tail("restoring\nerror NU1101: no package\n") // "restoring | error NU1101: no package"
 */
function tail(output: string): string {
  return output
    .trim()
    .split(/\r?\n/)
    .slice(-ERROR_TAIL_LINES)
    .join(" | ")
    .slice(-ERROR_TAIL_MAX_CHARS);
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
    const child = spawn(dockerPath(), args, {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let isTimeout = false;
    const timer = setTimeout(() => {
      isTimeout = true;
      if (containerToKill !== undefined)
        execFile(dockerPath(), ["kill", containerToKill], () => undefined);
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

/**
 * Docker's install locations: per-user and machine-wide Docker Desktop on Windows,
 * Docker Desktop on macOS, the distribution packages on Linux.
 */
const DOCKER_LOCATIONS = [
  join(homedir(), "AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe"),
  "C:/Program Files/Docker/Docker/resources/bin/docker.exe",
  "/Applications/Docker.app/Contents/Resources/bin/docker",
  "/usr/local/bin/docker",
  "/usr/bin/docker",
];

/**
 * The docker binary by absolute path. A bare "docker" would be looked up on PATH,
 * so a writable folder early on PATH could put another program in its place, and
 * that program would run the model-written tests outside the container.
 *
 * @throws when Docker is in none of the known locations.
 */
function dockerPath(): string {
  const found = DOCKER_LOCATIONS.find((location) => existsSync(location));
  if (found === undefined)
    throw new Error(
      `Docker not found in ${DOCKER_LOCATIONS.join(", ")}. Install Docker Desktop, or run with --no-tests.`,
    );
  return found;
}
