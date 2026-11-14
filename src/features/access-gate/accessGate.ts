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

// A base for parsing `next` against. The reserved `.invalid` top-level domain can
// never be a real origin, so a parsed URL that keeps this origin is on our site.
const SAME_SITE_BASE = "http://gate.invalid";

/**
 * Narrows a `next` query value to a path on this site, so the unlock page
 * cannot be used as an open redirect.
 *
 * @example safeNextPath("/reviewer?x=1") // "/reviewer?x=1"
 * @example safeNextPath("//evil.com") // "/"
 * @example safeNextPath("/.//evil.com") // "/"
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/")) return "/";
  // Parse it the way the browser will, instead of checking prefixes: the URL
  // parser drops tabs and newlines first, so "/\t/evil.com" means "//evil.com".
  const url = new URL(next, SAME_SITE_BASE);
  if (url.origin !== SAME_SITE_BASE) return "/";
  if (url.pathname === "/unlock" || url.pathname.startsWith("/unlock/")) return "/";
  // Dot segments can collapse into a protocol-relative path after the origin
  // check: "/.//evil.com" parses on this origin but its pathname is
  // "//evil.com", which a redirect would send to evil.com.
  if (url.pathname.startsWith("//")) return "/";
  return url.pathname + url.search + url.hash;
}

// Link-preview crawlers carry no cookie; a redirect to /unlock would leave shared links without an image.
const SOCIAL_PREVIEW_PATH = "/opengraph-image";

/**
 * The proxy step: lets a request through when the gate is off or the visitor
 * holds the right cookie (or asks for the social preview image), and otherwise sends them to `/unlock`. Every
 * response while the gate is on, the preview image included, asks search engines not to index the site. With the gate off,
 * `/unlock` itself answers with a 307 to `next`: doing it here, rather than in
 * the page, keeps the root loading boundary from streaming a 200 first.
 */
export async function accessGate(request: NextRequest): Promise<NextResponse> {
  const code = readAccessCode();
  const isUnlockPage = request.nextUrl.pathname === "/unlock";
  if (code === null) return isUnlockPage ? redirectPastUnlock(request) : NextResponse.next();
  if (isUnlockPage) return NextResponse.next();

  const isSocialPreview = request.nextUrl.pathname === SOCIAL_PREVIEW_PATH;
  const cookie = request.cookies.get(ACCESS_COOKIE)?.value;
  const response =
    isSocialPreview || cookie === (await accessCookieValue(code))
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

function redirectPastUnlock(request: NextRequest): NextResponse {
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  const target = new URL(next, request.url);
  // A second guard at the redirect itself: whatever safeNextPath returns, this
  // response never leaves the site.
  if (target.origin !== request.nextUrl.origin) return NextResponse.redirect(new URL("/", request.url));
  return NextResponse.redirect(target);
}
