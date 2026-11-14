/**
 * The `docker run` arguments of the A5 runner. A5's tests are model-written C#,
 * so the container is locked down in one place: no host environment, no extra
 * privileges, only the one worktree and a NuGet cache mounted. Restore gets the
 * network because it runs before any model-written file exists; the test phase
 * gets none. Pure functions over strings, so tests can read the exact command.
 * Spec section 6, A5; the containment limits are in docs/decisions.md.
 */
import { CONTAINER_USER, DOTNET_SDK_IMAGE, NUGET_VOLUME } from "../../policy/differentialTests";

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

/** Where the worktree is mounted inside the container. */
export const CONTAINER_WORKTREE = "/work";

/** Where the NuGet volume is mounted inside the container. */
export const CONTAINER_NUGET = "/nuget";

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
