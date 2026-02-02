import { logger } from "@workspace/core";
import { useCallback, useEffect } from "react";
import { useStore } from "../store/store";
import type { OrdersData, PacketsData } from "../types/data/transformedBoards";

export function useAppMode(
  packets: PacketsData | null,
  commands: OrdersData | null,
  isLoading: boolean,
  backendConnected: boolean,
) {
  const setAppMode = useStore((s) => s.setAppMode);
  const appMode = useStore((s) => s.appMode);
  const modeOverride = useStore((s) => s.modeOverride);

  const determineAppMode = useCallback(() => {
    // If there's an override, use it
    if (modeOverride !== null) {
      logger.testingView.log("[DEBUG] Mode Override Active:", modeOverride);
      return modeOverride;
    }

    const isForceDev = import.meta.env.VITE_FORCE_DEV === "true";
    const isDev = import.meta.env.DEV || isForceDev;
    const hasData = !!(packets?.boards && commands?.boards);
    const hasError = !hasData || !backendConnected;

    // Debug logs
    // logger.testingView.log("[DEBUG] isDev", isDev);
    // logger.testingView.log("[DEBUG] isLoading", isLoading);
    // logger.testingView.log("[DEBUG] hasData", hasData);
    // logger.testingView.log("[DEBUG] backendConnected", backendConnected);
    // logger.testingView.log("[DEBUG] hasError", hasError);

    if (isLoading) return "loading";
    if (!hasError) return "active";
    if (isDev) return "mock";
    return "error";
  }, [isLoading, packets, commands, backendConnected, modeOverride]);

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
