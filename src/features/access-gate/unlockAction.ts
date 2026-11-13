"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACCESS_COOKIE, accessCookieValue, readAccessCode, safeNextPath } from "./accessGate";

/** What the unlock form shows: nothing yet, a wrong code, or success with where to go next. */
export type UnlockState =
  | { status: "idle" }
  | { status: "error" }
  | { status: "unlocked"; next: string };

const SEVEN_DAYS_IN_SECONDS = 7 * 24 * 60 * 60;

/**
 * Server action behind the unlock form: checks the code and, when it matches,
 * sets the access cookie. Works as a plain form post, so it needs no JavaScript.
 */
export async function unlock(_previous: UnlockState, formData: FormData): Promise<UnlockState> {
  const next = safeNextPath(String(formData.get("next") ?? ""));
  const expectedCode = readAccessCode();
  if (expectedCode === null) redirect(next);

  if (String(formData.get("code") ?? "").trim() !== expectedCode) return { status: "error" };

  (await cookies()).set(ACCESS_COOKIE, await accessCookieValue(expectedCode), {
    httpOnly: true,
    // Safari refuses Secure cookies on http://localhost; Vercel always serves HTTPS.
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SEVEN_DAYS_IN_SECONDS,
  });
  return { status: "unlocked", next };
}
