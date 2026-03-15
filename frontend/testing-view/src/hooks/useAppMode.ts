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

    if (isLoading || isRestarting) return "loading";

    if (!packets || !commands) {
      if (error) return isDev ? "mock" : "error";
      return "loading";
    }

    if (hasData && !error) return "active";
    if (isDev) return "mock";
    return "error";
  }, [isLoading, packets, commands, isRestarting, modeOverride, error]);

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
