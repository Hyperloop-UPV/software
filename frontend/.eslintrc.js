// This configuration only applies to the package manager root.
/** @type {import("eslint").Linter.Config} */
module.exports = {
  ignorePatterns: ["testing-view/**", "competition-view/**", "frontend-kit/**"],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: true,
  },
};
