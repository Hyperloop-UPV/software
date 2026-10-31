import { Battery, Layout, MessageSquare } from "@hyperloop-upv/frontend-kit/icons";

export const PAGES = {
  "/":          { title: "Competition View",  icon: Layout },
  "/batteries": { title: "Batteries",  icon: Battery },
  "/messages":  { title: "Messages",   icon: MessageSquare },
} as const;

export const PAGES_ARRAY = Object.entries(PAGES).map(
  ([url, { title, icon }]) => ({ title, icon, url }),
);
