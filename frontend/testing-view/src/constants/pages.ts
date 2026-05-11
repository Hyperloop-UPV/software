import { FlaskConical, ScrollText, Terminal } from "@workspace/ui/icons";

/** Pages of the application showed in the left sidebar. */
export const PAGES = {
  "/": { title: "Testing", icon: FlaskConical },
  "/logs": { title: "Logs", icon: ScrollText },
  "/flashing": { title: "Flashing", icon: Terminal },
};

/** Pages of the application showed in the left sidebar. The same thing as `PAGES` but in the array format. */
export const PAGES_ARRAY = Object.entries(PAGES).map(
  ([url, { title, icon }]) => ({ title, icon, url }),
);
