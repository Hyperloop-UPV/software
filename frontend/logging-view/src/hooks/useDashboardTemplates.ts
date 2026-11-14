import { useSyncExternalStore } from "react";
import {
  listTemplates,
  subscribeTemplates,
} from "../lib/normal/dashboardStorage";

/** The saved dashboard templates, newest first; updates when they change. */
export function useDashboardTemplates() {
  return useSyncExternalStore(subscribeTemplates, listTemplates);
}
