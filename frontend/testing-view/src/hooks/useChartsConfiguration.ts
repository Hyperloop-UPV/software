import { useEffect } from "react";
import { MOCK_CHARTS } from "../mocks/chartsConfigurations";
import { useStore } from "../store/store";

export function useChartsConfiguration() {
  const appMode = useStore((s) => s.appMode);
  const setCharts = useStore((s) => s.setCharts);

  useEffect(() => {
    // In mock mode, use mock data
    if (appMode === "mock") {
      setCharts(MOCK_CHARTS);
    }
  }, [appMode, setCharts]);
}
