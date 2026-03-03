import { logger } from "@workspace/core";
import { useCallback, useEffect } from "react";
import { useStore } from "../store/store";
import type { OrdersData, PacketsData } from "../types/data/board";

export function useAppMode(
  packets: PacketsData | null,
  commands: OrdersData | null,
  isLoading: boolean,
) {
  const setAppMode = useStore((s) => s.setAppMode);
  const appMode = useStore((s) => s.appMode);
  const modeOverride = useStore((s) => s.modeOverride);
  const isRestarting = useStore((s) => s.isRestarting);
  const error = useStore((s) => s.error);

  const determineAppMode = useCallback(() => {
    // If there's an override, use it
    if (modeOverride !== null) {
      logger.testingView.log("[DEBUG] Mode Override Active:", modeOverride);
      return modeOverride;
    }

    const isForceDev = import.meta.env.VITE_FORCE_DEV === "true";
    const isDev = import.meta.env.DEV || isForceDev;

    const hasData = !!(packets?.boards && commands?.boards);
    const hasError = !hasData || error;

    // Debug logs
    // logger.testingView.log("[DEBUG] isDev", isDev);
    // logger.testingView.log("[DEBUG] isLoading", isLoading);
    // logger.testingView.log("[DEBUG] hasData", hasData);
    // logger.testingView.log("[DEBUG] hasError", hasError);

    if (isLoading || isRestarting) return "loading";

    if (!packets || !commands) {
      // If we have an explicit error, show it.
      if (hasError) return "error";

      // Otherwise, we are just waiting for data.
      return "loading";
    }

    if (!hasError) return "active";
    if (isDev) return "mock";
    return "error";
  }, [isLoading, packets, commands, isRestarting, modeOverride]);

  // Determine and set app mode
  useEffect(() => {
    const newAppMode = determineAppMode();

    if (newAppMode !== appMode) {
      logger.testingView.log("App mode: ", newAppMode);
      setAppMode(newAppMode);
    }
  }, [determineAppMode, setAppMode, appMode]);

  return;
}
