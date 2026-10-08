import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "src-tauri/target/**",
      "target/**",
      "crates/**/target/**",
      "landing/**",
      "commitlint.config.js",
      "eslint.config.mjs",
      "src/lib/engine-wasm/**",
    ],
  },
  js.configs.recommended,
  // Untyped (no parserOptions.project) so it can lint fast and avoid
  // turning the whole existing codebase red in one go.
  ...tseslint.configs.recommended,
  ...tseslint.configs.stylistic,
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "off",
        { allowConstantExport: true },
      ],
      "react-hooks/exhaustive-deps": "off",
    },
  },
  {
    // Test doubles legitimately use `any` and no-op stubs.
    files: [
      "src/**/*.test.{ts,tsx}",
      "src/**/__tests__/**",
      "src/**/__mocks__/**",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-empty-function": "off",
    },
  },
);
