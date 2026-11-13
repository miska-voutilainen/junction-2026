import type { NextRequest } from "next/server";
import { accessGate } from "@/features/access-gate";

/** Temporary access gate on every page; see src/features/access-gate/README.md. */
export function proxy(request: NextRequest) {
  return accessGate(request);
}

export const config = {
  // Skips /unlock, Next's own assets and static files, so the form can load.
  // Example: "/logo.svg" and "/_next/static/chunk.js" are skipped; "/changes/mp-2283" is gated.
  matcher: [
    "/((?!unlock|_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|woff|woff2)$).*)",
  ],
};
