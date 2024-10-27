// @ts-check
import eslint from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import globals from "globals";
import tseslint from "typescript-eslint";

export default [
  { files: ["**/*.{js,mjs,cjs,ts}", "tsup.config.ts", "vitest.config.ts"] },
  { ignores: ["node_modules", "dist/**"] },
  { languageOptions: { globals: globals.node } },
  {
    linterOptions: {
      reportUnusedDisableDirectives: "error",
    },
  },
  {
    rules: {
      "no-restricted-imports": ["error", { patterns: ["\\..*"] }],
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  eslint.configs.recommended,
  ...tseslint.configs.strict,
  ...tseslint.configs.stylistic,
  eslintConfigPrettier,
  eslintPluginPrettierRecommended,
];
