import { Activity, Layout, ScrollText, Send, Terminal, Wrench } from "@workspace/ui/icons";
import { Zap } from "lucide-react";

export const PAGES = {
  "/":           { title: "Overview",  icon: Layout    },
  "/charts":     { title: "Charts",    icon: Activity  },
  "/batteries":  { title: "Batteries", icon: Wrench    },
  "/boards":     { title: "Boards",    icon: Terminal  },
  "/booster":    { title: "Booster",   icon: Zap       },
  "/orders":     { title: "Orders",    icon: Send      },
  "/messages":   { title: "Messages",  icon: ScrollText },
} as const;

export const PAGES_ARRAY = Object.entries(PAGES).map(
  ([url, { title, icon }]) => ({ title, icon, url }),
);
