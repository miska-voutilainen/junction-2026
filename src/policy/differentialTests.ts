/**
 * Limits and wording of the differential test step (A5). Kept apart from the
 * runner so a reviewer can read and argue with every number and every note the
 * evidence shows. Spec section 6, A5.
 */

/** Longest a `dotnet test` run on one side may take before it is killed: the spec's budget, past which the go/no-go counts as failed. */
export const TEST_RUN_TIMEOUT_MS = 15 * 60 * 1000;

/** Longest style example shown to A5: the model needs the test idiom, not every test in the file. */
export const STYLE_EXAMPLE_MAX_CHARS = 12_000;

/** Longest test file A5 may write: a requirement item needs a few assertions, not a suite. */
export const GENERATED_TEST_MAX_CHARS = 12_000;

/** Most PR test names in one `--filter`, so the command line stays far below the Windows limit of about 32,000 characters. */
export const PR_TEST_NAMES_MAX = 40;

/** Output kept in the review (spec section 5): the end of a run holds the failure and the summary line. */
export const TEST_OUTPUT_MAX_CHARS = 2_000;

/** Prefix of every A5 test name, so a name never matches one of the repository's own tests in the `--filter`. */
export const GENERATED_TEST_PREFIX = "A5_";

/** Note on evidence from the PR's own test (spec section 6). */
export const PR_TEST_NOTE = "the PR's own test: the same agent wrote the code and the test";

/** Note on a test that passes on both versions (spec section 6). */
export const NO_DIFFERENCE_NOTE = "the test doesn't tell the versions apart";

/**
 * The container image A5's tests run in, pinned by digest. A moving tag would
 * change the SDK under a recorded review: the same test could build differently
 * next month. Digest of the multi-platform index of `mcr.microsoft.com/dotnet/sdk:8.0`
 * as of 2026-11-14; bump it deliberately and re-record.
 */
export const DOTNET_SDK_IMAGE =
  "mcr.microsoft.com/dotnet/sdk:8.0@sha256:1b955f179b02df4f0eb5fadedaa898cbe44d620a64aab52eec72c8e91d1355b5";

/** Docker volume that holds the NuGet cache, so the host's own cache and profile never reach the container. */
export const NUGET_VOLUME = "countersign-a5-nuget";

/** User inside the container: the `app` user the .NET 8 images define (uid 1654), so model-written code does not run as root. */
export const CONTAINER_USER = "1654:1654";
