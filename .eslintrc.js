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
    "no-unused-vars": [ "error"],
    "eqeqeq": ["error", "always"],
    "jsdoc/require-param-type": ["off"],
    "jsdoc/require-returns-type": ["off"],
    "jsdoc/no-types": ["error"],
    "jsdoc/require-jsdoc": ["off", {"require":{"MethodDefinition":true}}]
  }
};
