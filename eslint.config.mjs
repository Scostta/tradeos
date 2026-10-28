import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Money no importa de Trading ni de Invest (CLAUDE.md, "Shell de módulos";
  // MONEY_SPEC.md §6). Lo compartido (shell, src/components, src/lib/ui,
  // helpers genéricos) sí.
  {
    files: [
      "src/app/(dashboard)/money/**",
      "src/lib/finance/**",
      "src/types/finance.ts",
      "src/services/*/finance.ts",
      "src/actions/finance.ts",
      "src/constants/copies/money/**",
    ],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{
          group: [
            "~/types/trade*", "~/types/invest*", "~/types/import*", "~/types/prop-firm*",
            "~/services/*/trade*", "~/services/*/invest*", "~/services/*/accounts*",
            "~/actions/trade*", "~/actions/invest*", "~/actions/import*", "~/actions/accounts*",
            "~/lib/calculations/*", "~/lib/parsers/*", "~/contexts/*",
            "~/constants/copies/invest*", "~/constants/copies/trades*",
            "~/app/(dashboard)/invest/*", "~/app/(dashboard)/(trading)/*",
            "**/invest/**", "**/(trading)/**",
          ],
          message: "Money no importa de Trading ni de Invest (CLAUDE.md, Shell de módulos).",
        }],
      }],
    },
  },
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
    // Job de screening en Python; su venv local trae .js de paquetes de pip.
    "scripts/screener/**",
  ]),
]);

export default eslintConfig;
