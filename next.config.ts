import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
