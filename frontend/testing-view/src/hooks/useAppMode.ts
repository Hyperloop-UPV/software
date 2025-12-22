import { useCallback, useEffect } from "react";
import { logger } from "@workspace/core";
import { useStore } from "../store/store";
import type { PacketsData } from "../types/AppData";
import type { OrdersData } from "../types/AppData";

export function useAppMode(
  packets: PacketsData | null,
  commands: OrdersData | null,
  packetsLoading: boolean,
  commandsLoading: boolean,
  backendConnected: boolean,
) {
  const setAppMode = useStore((s) => s.setAppMode);
  const appMode = useStore((s) => s.appMode);

  const determineAppMode = useCallback(() => {
    const isDev = import.meta.env.DEV;
    const isLoading = packetsLoading || commandsLoading;
    const hasData = packets?.boards && commands?.boards;
    const hasError = !hasData || !backendConnected;

    logger.testingView.log("[DEBUG] isDev", isDev);
    logger.testingView.log("[DEBUG] isLoading", isLoading);
    logger.testingView.log("[DEBUG] hasData", hasData);
    logger.testingView.log("[DEBUG] backendConnected", backendConnected);
    logger.testingView.log("[DEBUG] hasError", hasError);

    if (isLoading) return "loading";
    if (!hasError) return "active";
    if (isDev) return "mock";
    return "error";
  }, [packetsLoading, commandsLoading, packets, commands, backendConnected]);

  // Determine and set app mode
  useEffect(() => {
    const newAppMode = determineAppMode();
    logger.testingView.log("App mode: ", newAppMode);
    setAppMode(newAppMode);
  }, [determineAppMode, setAppMode]);

  return appMode;
}
