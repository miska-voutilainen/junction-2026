/** Model and limits shared by both backends (spec section 6, "Model and client", and 9.1, T10). */

/** The one model every call uses. */
export const MODEL = "claude-opus-5-5";

/** Reasoning effort for every call; the API backend sends it, Claude Code reads it from the environment. */
export const EFFORT = "high";

/**
 * Latency budget for one model request (spec 9.1, T10): a request over it logs a
 * warning but keeps going, since a slow answer on a large change is still a good answer.
 */
export const CALL_LATENCY_BUDGET_MS = 120_000;

/**
 * Hard stop for one model request (spec 9.1, T10: warn at 120 s, fail at 180 s). A call
 * that retries after a validation failure makes two requests, so it can take twice this long.
 */
export const CALL_TIMEOUT_MS = 180_000;

/**
 * Request timeout inside the SDK, equal to the hard stop. The client's own abort
 * signal fires first, so a slow request surfaces as ModelTimeoutError, not an SDK error.
 */
export const API_REQUEST_TIMEOUT_MS = CALL_TIMEOUT_MS;

/** SDK-level retries for network errors and 5xx; validation retries are ours and happen once. */
export const API_MAX_RETRIES = 2;

/** Output cap for the API backend. Adaptive thinking tokens count against it. */
export const API_MAX_TOKENS = 16_000;

/** Server-side refusal fallback: the API retries a declined request on its default fallback model. */
export const API_FALLBACK_BETA = "server-side-fallback-2026-07-01";

/** Price per million input tokens in US dollars, from the partner credit terms. */
export const INPUT_USD_PER_MILLION_TOKENS = 4;

/** Price per million output tokens in US dollars, from the partner credit terms. */
export const OUTPUT_USD_PER_MILLION_TOKENS = 20;

/** Verda Inference's OpenAI-compatible endpoint (docs.verda.com/inference/openai-compatibility). */
export const KIMI_BASE_URL = "https://inference.verda.com/v1";

/** Verda's id for Kimi K3.1 Pro. Moonshot's own API spells it differently; the two are not interchangeable. */
export const KIMI_MODEL = "kimi-k3-1-pro";

/**
 * Thinking budget for Kimi calls. The model defaults to `max`, which can spend the whole
 * token budget on reasoning and return empty content; `low` keeps short structured answers fast.
 */
export const KIMI_REASONING_EFFORT = "low";

/** Output cap for Kimi calls, reasoning tokens included; a request reserves it against the tokens-per-minute limit. */
export const KIMI_MAX_TOKENS = 4_000;

/** Verda list price per million input tokens in US dollars (verda.com/models/kimi-k3-1-pro; confirm in the console). */
export const KIMI_INPUT_USD_PER_MILLION_TOKENS = 2;

/** Verda list price per million output tokens in US dollars; reasoning tokens bill as output. */
export const KIMI_OUTPUT_USD_PER_MILLION_TOKENS = 10;

/** Validation failures are retried once, with the validation error sent back to the model. */
export const MAX_VALIDATION_RETRIES = 1;

/** Hex characters of the recording key used in file names; 64 bits is far beyond what one run needs. */
export const RECORDING_KEY_FILE_CHARS = 16;

/**
 * Longest `claude` command line we build, in characters. Windows rejects command lines over
 * about 32,000; the system text and the JSON schema travel as arguments, only the prompt is on stdin.
 */
export const CLI_ARGUMENT_LIMIT_CHARS = 30_000;

/** Characters of a Claude Code reply shown in an error, enough to recognise it without dumping the prompt. */
export const ERROR_EXCERPT_CHARS = 200;
