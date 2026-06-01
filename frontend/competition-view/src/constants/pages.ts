import { Activity, ScrollText } from "@workspace/ui/icons";

export const PAGES = {
  "/": { title: "Overview", icon: Activity },
  "/messages": { title: "Messages", icon: ScrollText },
} as const;

export const PAGES_ARRAY = Object.entries(PAGES).map(
  ([url, { title, icon }]) => ({ title, icon, url }),
);
