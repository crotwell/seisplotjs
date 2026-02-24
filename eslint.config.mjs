// @ts-check

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import jsdoc from "eslint-plugin-jsdoc";
import jest from "eslint-plugin-jest";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    plugins: {
      jsdoc: jsdoc,
      jest: jest
    },
    rules: {
        semi: ["error", "always"],
        "no-var": ["error"],
        "no-console": ["error"],

        "@typescript-eslint/no-unused-vars": ["error", {
            argsIgnorePattern: "^_.*",
        }],

        "@typescript-eslint/restrict-template-expressions": ["error", {
            allowNumber: true,
            allowNullish: true,
            allowBoolean: true,
        }],

        eqeqeq: ["error", "smart"],
        "jsdoc/require-param-type": ["off"],
        "jsdoc/require-returns-type": ["off"],
        "jsdoc/no-types": ["error"],

        "jsdoc/require-jsdoc": ["off", {
            require: {
                MethodDefinition: true,
            },
        }],

        "jsdoc/tag-lines": ["off"],
        "@typescript-eslint/no-explicit-any": ["off"],
        "@typescript-eslint/no-unsafe-assignment": ["off"],
        "@typescript-eslint/no-unsafe-member-access": ["off"],
        "@typescript-eslint/no-unsafe-argument": ["off"],
        "@typescript-eslint/no-unnecessary-type-assertion": ["off"],
        "@typescript-eslint/no-this-alias": ["off"],
        "jest/no-done-callback": ["off"],
        "@typescript-eslint/no-unsafe-return": ["off"],
        "@typescript-eslint/no-unsafe-call": ["off"],
        "@typescript-eslint/no-namespace": ["off"],
    },
  },
);
