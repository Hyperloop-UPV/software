import { Activity, BatteryFull, CircuitBoard, LineChart, ScrollText } from "@workspace/ui/icons";

export const PAGES = {
  "/":           { title: "Overview",  icon: Activity     },
  "/charts":     { title: "Charts",    icon: LineChart    },
  "/batteries":  { title: "Batteries", icon: BatteryFull  },
  "/boards":     { title: "Boards",    icon: CircuitBoard },
  "/messages":   { title: "Messages",  icon: ScrollText   },
} as const;

export const PAGES_ARRAY = Object.entries(PAGES).map(
  ([url, { title, icon }]) => ({ title, icon, url }),
);
