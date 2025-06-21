// @ts-check

const globals = require("globals");
const pluginJs = require("@eslint/js");
const pluginReact = require("eslint-plugin-react");

module.exports = [
  // 1. Global configuration for all JS/JSX files
  {
    linterOptions: {
      reportUnusedDisableDirectives: "warn",
    },
  },
  // 2. Configuration for Backend (Node.js) files - main.js, preload.js, services/, agents/
  {
    files: ["main.js", "preload.js", "services/**/*.js", "agents/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: {
        ...globals.node,
      },
    },
    rules: {
      ...pluginJs.configs.recommended.rules,
      "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
      "no-undef": "error",
      "semi": ["warn", "always"],
      "quotes": ["warn", "double"]
      // Add more backend-specific rules here
    },
  },
  // 3. Configuration for Frontend (React/JSX) files - frontend/src/
  {
    files: ["frontend/src/**/*.{js,jsx}"],
    ...pluginReact.configs.flat.recommended, // Use the flat config version
    // Merge and override options as needed
    languageOptions: {
      ...pluginReact.configs.flat.recommended.languageOptions,
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ...pluginReact.configs.flat.recommended.languageOptions?.parserOptions,
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        "process": "readonly", // for process.env
      },
    },
    rules: {
      ...pluginReact.configs.flat.recommended.rules,
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "warn",
      "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
      "semi": ["warn", "always"],
      "quotes": ["warn", "single", { "avoidEscape": true, "allowTemplateLiterals": true }]
    },
    settings: {
      ...pluginReact.configs.flat.recommended.settings,
      react: {
        ...pluginReact.configs.flat.recommended.settings?.react,
        version: "detect",
      },
    },
  },
  // 4. Configuration for root-level JS files (like eslint.config.js itself, scripts, etc.)
  //    This ensures files not covered by backend or frontend specific configs are also linted.
  {
    files: ["*.js"], // For files in the root like eslint.config.js, other config files
    excludedFiles: ["main.js", "preload.js", "frontend/**/*.*"], // Exclude already covered
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs", // Or module if appropriate for your root files
      globals: {
        ...globals.node, // Assuming root scripts are Node-based
      },
    },
    rules: {
      ...pluginJs.configs.recommended.rules,
      "no-unused-vars": "warn",
      "no-undef": "error",
      "semi": ["warn", "always"],
      "quotes": ["warn", "double"]
    },
  },
];
