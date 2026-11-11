import { config } from "@hyperloopupv/eslint-config/vite";

export default [
  ...config,
  {
    // Icons (and any other shared primitive) must come from the kit, so the
    // catalogue stays the single place where they are curated. The legacy
    // vanilla app in src/base/ is not built and is exempt.
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/base/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "lucide-react",
              message:
                "Import icons from @hyperloopupv/frontend-kit/icons. Add a missing icon with `pnpm icon:add <icon-name> src/icons` in frontend/frontend-kit/kit.",
            },
          ],
        },
      ],
    },
  },
];
