import { Camera, FlaskConical, ScrollText } from "@workspace/ui/icons";

export const PAGES = {
  "/": { title: "Testing", icon: FlaskConical },
  "/logs": { title: "Logs", icon: ScrollText },
  "/camera-view": { title: "Camera View", icon: Camera },
};

export const PAGES_ARRAY = Object.entries(PAGES).map(
  ([url, { title, icon }]) => ({ title, icon, url }),
);
