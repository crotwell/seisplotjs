module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint", "promise", "jest", "jsdoc"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:jest/recommended",
    "plugin:jsdoc/recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
  ],
  env: {
    es6: true,
    browser: true,
    "jest/globals": true,
  },
  parserOptions: {
    ecmaVersion: 6,
    sourceType: "module",
    tsconfigRootDir: __dirname,
    project: ["./tsconfig.json"],
  },
  rules: {
    semi: ["error", "always"],
    "no-var": ["error"],
    "no-console": ["error"],
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_.*" }],
    "@typescript-eslint/restrict-template-expressions": [
      "error",
      {
        allowNumber: true,
        allowNullish: true,
        allowBoolean: true,
      },
    ],
    eqeqeq: ["error", "smart"],
    "jsdoc/require-param-type": ["off"],
    "jsdoc/require-returns-type": ["off"],
    "jsdoc/no-types": ["error"],
    "jsdoc/require-jsdoc": ["off", { require: { MethodDefinition: true } }],
    "jsdoc/tag-lines": ["off"],
    // above are rule configs I think should be different from std eslint
    //
    // below are errors rules should be fixed in code, but haven't gotten to yet
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
};
