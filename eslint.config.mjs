import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Design reference mockups — not application code, not linted.
    ".claude-docs/**",
    // E2E tests + Playwright config — handled by Playwright tooling, not Next lint.
    "tests/**",
    "playwright.config.ts",
  ]),
]);

export default eslintConfig;
