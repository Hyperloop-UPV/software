import { Activity, BatteryFull, CircuitBoard, ScrollText } from "@workspace/ui/icons";

export const PAGES = {
  "/":           { title: "Overview",  icon: Activity     },
  "/batteries":  { title: "Batteries", icon: BatteryFull  },
  "/boards":     { title: "Boards",    icon: CircuitBoard },
  "/messages":   { title: "Messages",  icon: ScrollText   },
} as const;

export const PAGES_ARRAY = Object.entries(PAGES).map(
  ([url, { title, icon }]) => ({ title, icon, url }),
);
