import { FlaskConical, ScrollText } from "@workspace/ui/icons";

export const PAGES = {
  "/": { title: "Testing", icon: FlaskConical },
  "/logs": { title: "Logs", icon: ScrollText },
};

export const PAGES_ARRAY = Object.entries(PAGES).map(
  ([url, { title, icon }]) => ({ title, icon, url }),
);
