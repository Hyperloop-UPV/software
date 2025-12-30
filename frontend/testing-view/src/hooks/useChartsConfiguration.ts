import { logger } from "@workspace/core";
import { useEffect } from "react";
import { MOCK_CHARTS } from "../mocks/chartsConfigurations";
import { useStore } from "../store/store";

const EMPTY_CHARTS = {
  "workspace-1": [],
  "workspace-2": [],
  "workspace-3": [],
};

export function useChartsConfiguration() {
  const appMode = useStore((s) => s.appMode);
  const previousAppMode = useStore((s) => s.previousAppMode);
  const setCharts = useStore((s) => s.setCharts);

  useEffect(() => {
    logger.testingView.log("Mode changed from", previousAppMode, "to", appMode);

    // In mock mode, use mock data
    if (appMode === "mock") {
      setCharts(MOCK_CHARTS);
    } else if (appMode === "active" && previousAppMode === "mock") {
      setCharts(EMPTY_CHARTS);
    }
  }, [appMode]);
}
