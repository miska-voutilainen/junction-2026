import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Accessibility and console rules for everything a person sees. eslint-config-next already
  // registers the jsx-a11y plugin; these are a stricter selection of jsx-a11y rules for app code. Console output
  // belongs to the pipeline and CLIs, never the app.
  {
    files: ["src/app/**/*.{ts,tsx}", "src/features/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}"],
    rules: {
      "no-console": "error",
      "jsx-a11y/anchor-is-valid": "error",
      "jsx-a11y/click-events-have-key-events": "error",
      "jsx-a11y/control-has-associated-label": [
        "error",
        { ignoreElements: ["audio", "canvas", "embed", "input", "textarea", "tr", "video"] },
      ],
      "jsx-a11y/label-has-associated-control": "error",
      "jsx-a11y/no-autofocus": "error",
      "jsx-a11y/no-noninteractive-element-interactions": "error",
      "jsx-a11y/no-static-element-interactions": "error",
      "jsx-a11y/interactive-supports-focus": "error",
      "jsx-a11y/heading-has-content": "error",
      "jsx-a11y/html-has-lang": "error",
      "jsx-a11y/no-redundant-roles": "error",
      "jsx-a11y/tabindex-no-positive": "error",
    },
  },
  // shadcn/ui primitives are generated; their a11y is the library's responsibility.
  {
    files: ["src/components/ui/**"],
    rules: {
      "jsx-a11y/click-events-have-key-events": "off",
      "jsx-a11y/no-noninteractive-element-interactions": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
