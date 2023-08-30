module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: [
    '@typescript-eslint',
    "promise",
    "jest",
    "jsdoc"
  ],
  "extends": [
    "eslint:recommended",
    'plugin:@typescript-eslint/recommended',
    "plugin:jest/recommended",
    "plugin:jsdoc/recommended",
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
  ],
  "env": {
    "es6": true,
    "browser": true,
    "jest/globals": true
  },
  "parserOptions": {
      "ecmaVersion": 6,
      "sourceType": "module",
    tsconfigRootDir: __dirname,
    project: ['./tsconfig.json'],
  },
  "rules": {
    "semi": ["error", "always"],
    "no-var": ["error"],
    "no-console": [ "error"],
    "@typescript-eslint/no-unused-vars": [ "error"],
    "@typescript-eslint/restrict-template-expressions": [ "error", {
        allowNumber: true,
        allowNullish: true,
        allowBoolean: true,
      }],
    "eqeqeq": ["error", "smart"],
    "jsdoc/require-param-type": ["off"],
    "jsdoc/require-returns-type": ["off"],
    "jsdoc/no-types": ["error"],
    "jsdoc/require-jsdoc": ["off", {"require":{"MethodDefinition":true}}],
    "jsdoc/tag-lines": ["off"]
  }
};
