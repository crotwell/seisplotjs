module.exports = {
    "extends": "eslint:recommended",
    "installedESLint": true,
    "plugins": [
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
