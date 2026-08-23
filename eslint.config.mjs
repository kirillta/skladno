import js from "@eslint/js";
import stylistic from "@stylistic/eslint-plugin";
import { defineConfig } from "eslint/config";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

import projectStyle from "./eslint-rules/project-style.mjs";


const sourceFiles = ["**/*.{js,mjs,cjs,ts,tsx}"];
const testFiles = ["**/*.test.{js,mjs,cjs,ts,tsx}"];


export default defineConfig(
    {
        ignores: [
            "**/coverage/**",
            "**/dist/**",
            "**/node_modules/**",
        ],
    },
    {
        files: sourceFiles,
        extends: [
            js.configs.recommended,
            tseslint.configs.recommended,
            tseslint.configs.stylistic,
        ],
        plugins: {
            "@stylistic": stylistic,
            "project-style": projectStyle,
        },
        rules: {
            "project-style/conditional-braces": "error",
            "project-style/two-blank-lines-between-declarations": "error",
            "@stylistic/brace-style": ["error", "1tbs"],
            "@stylistic/comma-spacing": "error",
            "@stylistic/comma-style": ["error", "last"],
            "@stylistic/eol-last": ["error", "always"],
            "@stylistic/indent": ["error", 4, {
                SwitchCase: 1,
            }],
            "@stylistic/keyword-spacing": "error",
            "@stylistic/lines-between-class-members": "off",
            "@stylistic/max-statements-per-line": ["error", {
                max: 1,
            }],
            "@stylistic/no-trailing-spaces": "error",
            "@stylistic/nonblock-statement-body-position": ["error", "below"],
            "@stylistic/padding-line-between-statements": [
                "error",
                {
                    blankLine: "always",
                    prev: ["if", "for", "while", "do", "switch", "try"],
                    next: "*",
                },
            ],
            "@stylistic/quotes": ["error", "double", {
                avoidEscape: true,
            }],
            "@stylistic/semi": ["error", "always"],
            "@stylistic/space-before-blocks": "error",
        },
    },
    {
        files: ["packages/server/**/*.{ts,tsx}", "packages/electron/**/*.{js,ts}", "packages/web/vite.config.ts", "scripts/**/*.{js,mjs,cjs}"],
        languageOptions: {
            globals: globals.node,
        },
    },
    {
        files: ["packages/web/src/**/*.{ts,tsx}"],
        languageOptions: {
            globals: globals.browser,
        },
    },
    {
        files: ["packages/web/src/**/*.{ts,tsx}"],
        plugins: {
            "react-hooks": reactHooks,
        },
        rules: {
            "project-style/no-accessible-label-selector": "error",
            "project-style/no-production-intl-provider": "error",
            "project-style/no-untranslated-ui-copy": ["error", {
                allowedLiterals: [
                    "S",
                    "Skladno",
                ],
            }],
            "react-hooks/exhaustive-deps": "warn",
            "react-hooks/rules-of-hooks": "error",
        },
    },
    {
        files: ["packages/web/src/i18n/I18nProvider.tsx"],
        rules: {
            "project-style/no-production-intl-provider": "off",
        },
    },
    {
        files: testFiles,
        rules: {
            "@typescript-eslint/no-explicit-any": "off",
            "project-style/no-accessible-label-selector": "off",
            "project-style/no-production-intl-provider": "off",
            "project-style/no-untranslated-ui-copy": "off",
            "require-yield": "off",
        },
    },
);
