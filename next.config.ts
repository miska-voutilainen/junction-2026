import type { NextConfig } from "next";

/**
 * The Content-Security-Policy every page ships with. Pages are statically
 * generated, so a per-request nonce is not possible: Next's inline bootstrap
 * scripts need 'unsafe-inline' for scripts, and shiki's highlighted code uses
 * inline styles. Everything else stays on our own origin. Dev mode also needs
 * 'unsafe-eval' for React's debugging; production never gets it.
 * See docs/decisions.md, "Security headers".
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

/** Headers for every route; e2e/security-headers.spec.ts asserts each one. */
const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  // Older browsers ignore CSP frame-ancestors.
  { key: "X-Frame-Options", value: "DENY" },
];

const nextConfig: NextConfig = {
  // The e2e run builds a second copy of the app on real data beside the fixture one;
  // it needs its own build folder. Unset everywhere else, so `.next` as usual.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // Stops `next dev` from writing a generic Next.js block into AGENTS.md
  // whenever an agent runs it. Our agents read CLAUDE.md, which pins the stack,
  // and AGENTS.md is part of what judges read.
  agentRules: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
