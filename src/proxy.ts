import type { NextRequest } from "next/server";
import { accessGate } from "@/features/access-gate";

/** Temporary access gate on every page; see src/features/access-gate/README.md. */
export function proxy(request: NextRequest) {
  return accessGate(request);
}

export const config = {
  // Skips Next's own assets and static files. /unlock is matched so the gate can redirect it when off.
  // Example: "/logo.svg" and "/_next/static/chunk.js" are skipped; "/changes/mp-2283" is gated.
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|woff|woff2)$).*)",
  ],
};
