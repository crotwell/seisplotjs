module.exports = {
    "extends": [
      "eslint:recommended",
      "plugin:flowtype/recommended"
    ],
    "plugins": [
      "flowtype",
        "standard",
        "promise"
    ],
    "env": {
      "es6": true,
      "browser": true
    },
    "parserOptions": {
        "ecmaVersion": 6,
        "sourceType": "module",
    },
    "rules": {
      "semi": ["error", "always"]
    }
};
