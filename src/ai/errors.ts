/** Errors the model client throws; each message says what happened and what to do next. */

/** The model declined the request. The step fails; the run writes no partial review. */
export class ModelRefusalError extends Error {
  constructor(promptVersion: string) {
    super(
      `The model refused the ${promptVersion} request. The step fails and no review is written. ` +
        `Check the input for content the model may decline, then run the step again.`,
    );
    this.name = "ModelRefusalError";
  }
}

/** The answer failed the call's zod schema twice (the second time after the error was sent back). */
export class ModelValidationError extends Error {
  constructor(promptVersion: string, detail: string) {
    super(
      `The ${promptVersion} answer failed schema validation after one retry: ${detail}. ` +
        `Run the step again, or fix the prompt's output schema if it keeps failing.`,
    );
    this.name = "ModelValidationError";
  }
}

/** AI_MODE=replay and no recording exists for this call. */
export class RecordingMissingError extends Error {
  constructor(promptVersion: string, file: string) {
    super(
      `No recording for this prompt, model and run index (${promptVersion}) at ${file}. ` +
        `The prompt or its input changed since the last recording. ` +
        `Run the step once with AI_MODE=record (for example pnpm pipeline run <changeId>) and commit the new file.`,
    );
    this.name = "RecordingMissingError";
  }
}

/** The call took longer than the per-call budget. */
export class ModelTimeoutError extends Error {
  constructor(promptVersion: string, seconds: number) {
    super(
      `The ${promptVersion} call took longer than ${seconds} s and was stopped. ` +
        `Run the step again; if it repeats, shorten the input.`,
    );
    this.name = "ModelTimeoutError";
  }
}

/** A recording exists but its answer no longer passes the call's schema. */
export class RecordingStaleError extends Error {
  constructor(promptVersion: string, file: string) {
    super(
      `Recording ${file} no longer matches the ${promptVersion} schema. ` +
        `Bump the prompt version and record again.`,
    );
    this.name = "RecordingStaleError";
  }
}

/** The answer was cut off at the output limit; a retry would cut off at the same place. */
export class ModelTruncatedError extends Error {
  constructor(promptVersion: string, maxTokens: number) {
    super(
      `The ${promptVersion} answer hit the ${maxTokens} token output limit and was cut off. ` +
        `Shorten the input or split the step; retrying the same prompt fails the same way.`,
    );
    this.name = "ModelTruncatedError";
  }
}
