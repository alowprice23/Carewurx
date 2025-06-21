const globals = require("globals");
const js = require("@eslint/js"); // Recommended rules

module.exports = [
  // Configuration for JavaScript files (backend, root scripts)
  {
    files: ["**/*.js"], // Apply to all JS files
    ignores: [
      "node_modules/**",
      "frontend/node_modules/**",
      "frontend/build/**",
      "dist/**",
      // We'll let frontend/.eslintrc.json handle frontend/src for now
      // to keep react-app presets easily.
      // This root config will lint other JS files.
      "frontend/src/**/*.js",
      "frontend/src/**/*.jsx",
    ],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs", // Default for backend .js files
      globals: {
        ...globals.node, // Backend specific globals
      }
    },
    rules: {
      ...js.configs.recommended.rules, // Start with recommended rules
      "no-unused-vars": "warn",
      "no-undef": "error",
      "indent": ["warn", 2],
      "semi": ["warn", "always"],
      "quotes": ["warn", "double"]
    }
  },
  // We could add a specific configuration for frontend/src here if we wanted
  // to manage it all from the root, but react-app preset is complex to replicate.
  // For now, the goal is to ensure backend and root files are linted.
];
