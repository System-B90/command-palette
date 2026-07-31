import js from "@eslint/js";
import stylistic from "@stylistic/eslint-plugin";
import { defineConfig } from "eslint/config";
import globals from "globals";
import importPlugin from "eslint-plugin-import";
import perfectionist from "eslint-plugin-perfectionist";
import reactPlugin from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import unicorn from "eslint-plugin-unicorn";
import unusedImports from "eslint-plugin-unused-imports";
import tseslint from "typescript-eslint";

/*
 * Ported from Bluz's `ui/eslint.config.mts`, where this component grew up, so
 * the code keeps linting the same way after extraction.
 *
 * Deliberately dropped, because they are Next.js/app concerns this package
 * does not have: `eslint-config-next` (and its `next` settings block), the
 * app-router filename exemptions, and the per-directory overrides for
 * `api-server/gantt/schema/**`.
 *
 * `no-restricted-imports` is kept in full, relative-path ban included, so the
 * package's own `@/*` alias mirrors Bluz's. That alias survives publication
 * because `build` runs `tsc-alias` after `tsc`, rewriting every `@/…` in the
 * emitted `.js`/`.d.ts` back to a relative specifier — consumers never see it.
 */
export default defineConfig([
    js.configs.recommended,
    {
        files: ["src/**/*.{ts,tsx}", "tests/**/*.ts"],
        plugins: {
            "@typescript-eslint": tseslint.plugin,
            "@stylistic": stylistic,
            import: importPlugin,
            "unused-imports": unusedImports,
            perfectionist: perfectionist,
            react: reactPlugin,
            "react-hooks": reactHooks,
            unicorn: unicorn,
        },
        languageOptions: {
            // The palette talks to `window`/`document` directly (global
            // hotkeys, `localStorage` recents), which `no-undef` would
            // otherwise flag — Bluz got these from `eslint-config-next`.
            globals: globals.browser,
            parser: tseslint.parser,
            parserOptions: {
                projectService: {
                    allowDefaultProject: ["tests/*.ts"],
                },
                tsconfigRootDir: import.meta.dirname,
            },
        },
        settings: {
            react: { version: "detect" },
        },
        rules: {
            "eol-last": ["error", "always"],
            "no-multiple-empty-lines": ["error", { max: 1, maxEOF: 0 }],
            indent: ["error", 4],

            // --- Variables, Types & Assertions ---
            "no-unused-vars": "off",
            "@typescript-eslint/no-unused-vars": "off",
            "unused-imports/no-unused-vars": [
                "warn",
                {
                    vars: "all",
                    varsIgnorePattern: "^_",
                    args: "after-used",
                    argsIgnorePattern: "^_",
                },
            ],
            "@typescript-eslint/method-signature-style": ["error", "property"],
            "@typescript-eslint/no-floating-promises": "error",
            "@typescript-eslint/array-type": ["error", { default: "generic" }],
            "@typescript-eslint/consistent-type-definitions": ["error", "type"],
            "@typescript-eslint/no-base-to-string": "error",
            "@typescript-eslint/ban-tslint-comment": "error",
            "@typescript-eslint/no-for-in-array": "error", // Use "of" instead
            "@typescript-eslint/prefer-for-of": "error",
            "@typescript-eslint/prefer-includes": "error",
            "@typescript-eslint/return-await": ["error", "always"],
            "@typescript-eslint/adjacent-overload-signatures": "error",
            "@typescript-eslint/ban-ts-comment": [
                "error",
                { "ts-ignore": "allow-with-description" },
            ],

            // --- Exports & Imports ---
            "import/no-default-export": "error",
            "import/no-cycle": "error",
            "unused-imports/no-unused-imports": "error",
            "no-restricted-imports": [
                "error",
                {
                    patterns: [
                        {
                            group: ["./*", "../*"],
                            message: "Use absolute paths.",
                            allowTypeImports: true,
                        },
                        {
                            // Barrel imports pull the whole of MUI into a
                            // consumer's graph; deep-import the one component.
                            regex: "^@mui/[^/]+$",
                        },
                    ],
                },
            ],
            "import/order": [
                "error",
                {
                    groups: [
                        "builtin",
                        "external",
                        "internal",
                        "parent",
                        "sibling",
                        "index",
                    ],
                    "newlines-between": "always",
                    alphabetize: { order: "asc", caseInsensitive: true },
                },
            ],
            "@typescript-eslint/consistent-type-exports": [
                "error",
                { fixMixedExportsWithInlineTypeSpecifier: true },
            ],

            // --- React & Perfectionist ---
            "react/jsx-no-leaked-render": [
                "error",
                { validStrategies: ["ternary", "coerce"] },
            ],
            "react-hooks/rules-of-hooks": "error",
            "react-hooks/exhaustive-deps": "warn",
            "perfectionist/sort-variable-declarations": [
                "error",
                { type: "alphabetical" },
            ],
            "perfectionist/sort-union-types": [
                "error",
                { type: "alphabetical" },
            ],
            "perfectionist/sort-jsx-props": ["error", { type: "alphabetical" }],

            // --- Structural Spacing ---
            "@stylistic/padding-line-between-statements": [
                "error",
                { blankLine: "always", prev: "interface", next: "*" },
                { blankLine: "always", prev: "*", next: "interface" },
                { blankLine: "always", prev: "function", next: "function" },
                { blankLine: "never", prev: "type", next: "type" },
                { blankLine: "always", prev: "import", next: "*" },
                { blankLine: "any", prev: "import", next: "import" },
            ],

            "object-curly-newline": [
                "error",
                { ObjectPattern: { multiline: true, consistent: true } },
            ],
            "object-property-newline": [
                "error",
                { allowAllPropertiesOnSameLine: true },
            ],

            // --- Filename Convention (Unicorn) ---
            "unicorn/filename-case": [
                "error",
                {
                    cases: {
                        kebabCase: true,
                        pascalCase: true,
                    },
                    ignore: ["types.ts", "index.ts"],
                },
            ],
        },
    },
    {
        files: ["tests/**/*.ts"],
        languageOptions: { globals: globals.node },
        rules: {
            // Tests import the built package by relative path on purpose —
            // there is no `@/*` alias pointing into `dist/`, and importing
            // `src/` would test something other than what ships.
            "no-restricted-imports": "off",
            // `node:test`'s `describe`/`test` return promises the runner owns.
            "@typescript-eslint/no-floating-promises": "off",
        },
    },
    {
        files: ["**/*.js", "**/*.mjs", "**/*.mts"],
        ...tseslint.configs.disableTypeChecked,
    },
    {
        // `site/` and `docs/api/` are generated by mkdocs and TypeDoc.
        ignores: ["dist/**", "node_modules/**", "site/**", "docs/api/**"],
    },
]);
