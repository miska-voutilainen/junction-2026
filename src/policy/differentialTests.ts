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
