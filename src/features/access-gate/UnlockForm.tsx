"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { unlock, type UnlockState } from "./unlockAction";

const BOXED_CODE_LENGTH = 4;
const REDIRECT_DELAY_MS = 600;
const IDLE: UnlockState = { status: "idle" };

/**
 * The code entry form for the temporary access gate.
 *
 * A four-digit code is one real input drawn as four boxes: the boxes sit
 * behind a transparent input, so screen readers, paste and autofill all see a
 * single field. Any other length gets a plain text field.
 *
 * @param codeLength Number of characters in the code, from the server.
 * @param next Same-site path to open once unlocked.
 */
export function UnlockForm({ codeLength, next }: { codeLength: number; next: string }) {
  const [state, formAction, isPending] = useActionState(unlock, IDLE);
  const [code, setCode] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [lastSeenState, setLastSeenState] = useState(state);
  const inputRef = useRef<HTMLInputElement>(null);

  // A wrong code clears the field. Done while rendering rather than in an
  // effect so the old digits never flash after the error appears.
  if (state !== lastSeenState) {
    setLastSeenState(state);
    if (state.status === "error") setCode("");
  }

  useEffect(() => {
    if (state.status === "error") inputRef.current?.focus();
  }, [state]);

  if (state.status === "unlocked") return <UnlockedNotice next={state.next} />;

  const isBoxed = codeLength === BOXED_CODE_LENGTH;
  const hasError = state.status === "error";
  const isComplete = code.length === codeLength;
  const label = isBoxed ? "4-digit code" : "Access code";

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="next" value={next} />
      <label htmlFor="access-code" className="text-lg font-semibold text-text-primary">
        {label}
      </label>
      <div className="group relative">
        {isBoxed && (
          <CodeBoxes code={code} isFocused={isFocused} hasError={hasError} length={codeLength} />
        )}
        <input
          ref={inputRef}
          id="access-code"
          name="code"
          value={code}
          onChange={(event) =>
            setCode(
              isBoxed ? event.target.value.replace(/\D/g, "") : event.target.value,
            )
          }
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          inputMode={isBoxed ? "numeric" : "text"}
          autoComplete="one-time-code"
          maxLength={codeLength}
          pattern={isBoxed ? "[0-9]*" : undefined}
          aria-invalid={hasError}
          aria-describedby="access-code-status"
          autoFocus
          className={
            isBoxed
              ? "absolute inset-0 h-full w-full cursor-text bg-transparent text-transparent caret-transparent outline-none"
              : `h-12 w-full rounded-control border-2 bg-surface-hover px-4 text-lg text-text-primary outline-none transition-colors duration-150 ease-[var(--ease-out)] motion-reduce:transition-none ${hasError ? "border-rose" : "border-transparent focus:border-focus-ring"}`
          }
        />
      </div>
      <p
        id="access-code-status"
        aria-live="polite"
        className={`min-h-[22px] text-sm ${hasError ? "text-rose-light" : "text-text-muted"}`}
      >
        {statusMessage(state, isPending)}
      </p>
      <button
        type="submit"
        disabled={!isComplete || isPending}
        className="min-h-11 w-full rounded-button bg-accent text-sm font-semibold text-white transition duration-150 ease-[var(--ease-out)] hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-focus-ring-on-accent active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100"
      >
        Unlock
      </button>
    </form>
  );
}

function statusMessage(state: UnlockState, isPending: boolean): string {
  if (isPending) return "Checking…";
  if (state.status === "error") return "That code doesn't match. Try again.";
  return "Type or paste the code.";
}

/** The decorative boxes behind the input; the box at the cursor gets the focus border. */
function CodeBoxes({
  code,
  isFocused,
  hasError,
  length,
}: {
  code: string;
  isFocused: boolean;
  hasError: boolean;
  length: number;
}) {
  const cursorIndex = Math.min(code.length, length - 1);
  return (
    <div aria-hidden="true" className="flex gap-[10px]">
      {Array.from({ length }, (_, index) => {
        const border = hasError
          ? "border-rose"
          : isFocused && index === cursorIndex
            ? "border-focus-ring"
            : "border-transparent";
        return (
          <div
            key={index}
            className={`flex aspect-[76/100] min-w-0 flex-[0_1_76px] items-center justify-center rounded-control border-2 bg-surface-hover text-[40px] font-semibold transition-colors duration-150 ease-[var(--ease-out)] group-hover:bg-border-subtle motion-reduce:transition-none ${border}`}
          >
            {code[index] ?? ""}
          </div>
        );
      })}
    </div>
  );
}

/** Shown after a right code: confirms, then moves on by itself. */
function UnlockedNotice({ next }: { next: string }) {
  const router = useRouter();

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = setTimeout(
      () => router.replace(next),
      prefersReducedMotion ? 0 : REDIRECT_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, [router, next]);

  return (
    <div role="status" className="flex flex-col items-center gap-3 text-center">
      <span className="flex size-12 items-center justify-center rounded-full border-2 border-green text-green motion-safe:animate-[unlock-pulse_600ms_var(--ease-out)_1]">
        <Check aria-hidden="true" className="size-6" />
      </span>
      <p className="text-lg font-semibold">Unlocked</p>
      <p className="text-text-muted">
        {next === "/" ? "Taking you to the inbox." : "Taking you back."}
      </p>
      <a
        href={next}
        className="inline-flex min-h-11 w-full items-center justify-center rounded-button bg-accent text-sm font-semibold text-white transition duration-150 ease-[var(--ease-out)] hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-focus-ring-on-accent active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100"
      >
        Continue
      </a>
    </div>
  );
}
