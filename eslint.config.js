const globals = require("globals");
const react = require("eslint-plugin-react");
const reactHooks = require("eslint-plugin-react-hooks");
const jsxA11y = require("eslint-plugin-jsx-a11y");
const jestPlugin = require("eslint-plugin-jest"); // Renamed to avoid conflict

module.exports = [
  // Base Node.js configuration (main.js, services, agents, etc.)
  {
    files: ["main.js", "services/**/*.js", "agents/**/*.js", "*.config.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "no-unused-vars": "warn",
      "no-undef": "error",
    },
  },
  // Configuration for preload.js (Node.js + Browser globals)
  {
    files: ["preload.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs", // Or "module" if it uses ES modules
      globals: {
        ...globals.node,
        ...globals.browser, // preload has access to window
      },
    },
    rules: {
      "no-unused-vars": "warn",
      "no-undef": "error",
    },
  },
  // Configuration for React frontend files (including JSX in tests)
  {
    files: ["frontend/src/**/*.{js,jsx}", "frontend/tests/**/*.{js,jsx}"],
    plugins: {
      react,
      "react-hooks": reactHooks,
      "jsx-a11y": jsxA11y,
      jest: jestPlugin, // Add Jest plugin here
    },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        ...globals.jest, // Add Jest globals for test files
      },
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: {
      ...react.configs.recommended.rules,
      ...jsxA11y.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      ...jestPlugin.configs.recommended.rules, // Add Jest rules
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "warn",
      "no-unused-vars": ["warn", { "varsIgnorePattern": "^React$" }],
      // Allow 'jsx' prop on 'style' tags for styled-jsx
      "react/no-unknown-property": ["error", { "ignore": ["jsx", "global"] }],
    },
  },
  // Global ignores
  {
    ignores: [
      "node_modules/",
      "frontend/node_modules/",
      "frontend/build/",
      "dist/", // Common output directory
      "coverage/",
      ".*", // Hidden files and directories (except those explicitly targeted)
      "*.md", // Markdown files
      "*.json", // JSON files (except package.json if linted by other means)
      "!frontend/.eslintrc.json" // Example if we were keeping it
    ],
  },
];
