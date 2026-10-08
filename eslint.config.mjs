import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Last, so it switches off any ESLint rules that would fight Prettier's formatting.
  prettier,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Playwright's reports and results (generated, and git-ignored).
    "playwright-report/**",
    "test-results/**",
    "blob-report/**",
    // Minified from src/embed/widget.js, which is linted.
    "public/widget.js",
    // Written by `pnpm tokens` (`cn build`).
    "src/lib/cn-tables.ts",
  ]),
]);

export default eslintConfig;
