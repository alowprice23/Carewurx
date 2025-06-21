const globals = require("globals");
const js = require("@eslint/js");

module.exports = [
  // Configuration for backend Node.js files
  {
    files: ["main.js", "preload.js", "services/**/*.js", "agents/**/*.js", "*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: {
        ...globals.node,
      }
    },
    rules: {
      ...js.configs.recommended.rules,
      "no-unused-vars": "warn",
      "no-undef": "error",
      // Example: enforce strict mode for backend files if desired
      // "strict": ["error", "global"],
    }
  },
  // Global ignores
  {
    ignores: [
        "frontend/", // Frontend has its own ESLint setup
        "dist/",     // Build output
        "node_modules/",
        "coverage/", // Coverage reports
        "*.md"       // Markdown files
        // "*.json", // Usually not linted by ESLint unless specific plugin
        // "*.txt"
    ]
  }
];
