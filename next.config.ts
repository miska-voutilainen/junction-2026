import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The e2e run builds a second copy of the app on real data beside the fixture one;
  // it needs its own build folder. Unset everywhere else, so `.next` as usual.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // Stops `next dev` from writing a generic Next.js block into AGENTS.md
  // whenever an agent runs it. Our agents read CLAUDE.md, which pins the stack,
  // and AGENTS.md is part of what judges read.
  agentRules: false,
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
