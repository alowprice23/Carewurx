const globals = require("globals");

module.exports = [
  {
    "languageOptions": {
      "ecmaVersion": "latest",
      "sourceType": "commonjs",
      "globals": {
        ...globals.browser,
        ...globals.node
      }
    },
    "rules": {
      "no-unused-vars": "warn",
      "no-undef": "error"
    }
  }
];
