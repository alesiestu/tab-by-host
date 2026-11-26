import js from "@eslint/js";

// Three contexts with different globals: service worker, extension pages, Node scripts/tests.
const browser = {
  console: "readonly", document: "readonly", window: "readonly", navigator: "readonly",
  setTimeout: "readonly", clearTimeout: "readonly", URL: "readonly", Blob: "readonly",
  crypto: "readonly", structuredClone: "readonly", globalThis: "readonly", fetch: "readonly"
};

const shared = {
  // require-atomic-updates is off: every reconciliation runs through the serial
  // queue in background.js, and the options page guards writes with `busy`.
  // Left on, it only reports false positives on loop-local variables.
  "require-atomic-updates": "off",
  "no-unused-vars": ["error", { argsIgnorePattern: "^_", caughtErrors: "none" }],
  "no-implicit-coercion": "warn",
  "prefer-const": "error",
  "no-var": "error",
  eqeqeq: ["error", "smart"],
  "no-console": "off"
};

export default [
  js.configs.recommended,
  {
    files: ["*.js"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      globals: { ...browser, chrome: "readonly" }
    },
    rules: shared
  },
  {
    files: ["scripts/**/*.js", "tests/**/*.js"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      globals: { ...browser, process: "readonly", chrome: "writable" }
    },
    // `new Promise(resolve => setTimeout(resolve, ms))` is the idiomatic sleep
    // used by the polling helper; the returned timer id is intentionally ignored.
    rules: { ...shared, "no-promise-executor-return": "off" }
  },
  { ignores: ["node_modules/**", ".playwright-mcp/**"] }
];
