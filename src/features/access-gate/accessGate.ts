import { NextResponse, type NextRequest } from "next/server";

/** Name of the cookie that proves a visitor entered the code. */
export const ACCESS_COOKIE = "cs_access";

/**
 * Reads the access code from the environment.
 *
 * @returns The trimmed code, or null when `ACCESS_CODE` is unset or empty.
 * Null is the kill switch: the gate is off and every page is open.
 */
export function readAccessCode(env: Record<string, string | undefined> = process.env): string | null {
  const code = env.ACCESS_CODE?.trim();
  return code ? code : null;
}

/**
 * The cookie value for a code: its sha256 in hex. Storing a hash rather than
 * a flag means changing the code signs everyone out.
 */
export async function accessCookieValue(code: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(code));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Narrows a `next` query value to a path on this site, so the unlock page
 * cannot be used as an open redirect.
 *
 * @example safeNextPath("/reviewer?x=1") // "/reviewer?x=1"
 * @example safeNextPath("//evil.com") // "/"
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/")) return "/";
  // Parse it the way the browser will, instead of checking prefixes: the URL
  // parser drops tabs and newlines first, so "/\t/evil.com" means "//evil.com".
  const url = new URL(next, SAME_SITE_BASE);
  if (url.origin !== SAME_SITE_BASE) return "/";
  if (url.pathname === "/unlock" || url.pathname.startsWith("/unlock/")) return "/";
  return url.pathname + url.search + url.hash;
}

const SAME_SITE_BASE = "http://gate.invalid";

/**
 * The proxy step: lets a request through when the gate is off or the visitor
 * holds the right cookie, and otherwise sends them to `/unlock`. Every gated
 * response asks search engines not to index the site.
 */
export async function accessGate(request: NextRequest): Promise<NextResponse> {
  const code = readAccessCode();
  if (code === null) return NextResponse.next();

  const cookie = request.cookies.get(ACCESS_COOKIE)?.value;
  const response =
    cookie === (await accessCookieValue(code))
      ? NextResponse.next()
      : redirectToUnlock(request);
  response.headers.set("X-Robots-Tag", "noindex");
  return response;
}

function redirectToUnlock(request: NextRequest): NextResponse {
  const { pathname, searchParams } = request.nextUrl;
  // A client-side navigation adds Next's internal "_rsc" parameter; the
  // visitor should come back to the clean URL.
  const visibleParams = new URLSearchParams(searchParams);
  visibleParams.delete("_rsc");
  const query = visibleParams.toString();
  const unlockUrl = new URL("/unlock", request.url);
  unlockUrl.searchParams.set("next", query ? `${pathname}?${query}` : pathname);
  return NextResponse.redirect(unlockUrl);
}
