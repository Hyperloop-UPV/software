import { config } from "@hyperloop-upv/eslint-config/react-internal";

/** @type {import("eslint").Linter.Config} */
export default [
  ...config,
  {
    // src/core is published as the ./core subpath and must stay usable outside
    // a React app, so the React-free boundary is enforced rather than just
    // documented in the README.
    files: ["src/core/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "react",
              message:
                "src/core must stay React-free. Anything needing React belongs in src/hooks or src/components.",
            },
            {
              name: "react-dom",
              message: "src/core must stay React-free.",
            },
          ],
        },
      ],
    },
  },
];
