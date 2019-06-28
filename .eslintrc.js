module.exports = {
    "extends": [
      "eslint:recommended",
      "plugin:flowtype/recommended",
      "plugin:jest/recommended"
    ],
    "plugins": [
      "flowtype",
      "standard",
      "promise",
      "jest"
    ],
    "env": {
      "es6": true,
      "browser": true,
      "jest/globals": true
    },
    "parserOptions": {
        "ecmaVersion": 6,
        "sourceType": "module",
    },
    "rules": {
      "semi": ["error", "always"],
      "no-console": [ "off"],
      "eqeqeq": ["error", "always"]
    }
};
