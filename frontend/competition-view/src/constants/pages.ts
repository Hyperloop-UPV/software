import { Layout, Send, Wrench } from "@workspace/ui/icons";

export const PAGES = {
  "/":          { title: "Dashboard",  icon: Layout },
  "/orders":    { title: "Orders",     icon: Send   },
  "/batteries": { title: "Batteries",  icon: Wrench },
} as const;

export const PAGES_ARRAY = Object.entries(PAGES).map(
  ([url, { title, icon }]) => ({ title, icon, url }),
);
