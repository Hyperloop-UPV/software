import { useFetchConfig, useTopic, useWebSocket } from "@workspace/ui/hooks";
import { useEffect } from "react";
import { Route, Routes } from "react-router";
import { AppModeRouter } from "./components/AppModeRouter";
import { ModeSwitcher } from "./components/DevTools/ModeSwitcher";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { useAppMode } from "./hooks/useAppMode";
import { useBoardData } from "./hooks/useBoardData";
import { useChartsConfiguration } from "./hooks/useChartsConfiguration";
import { useErrorHandler } from "./hooks/useErrorHandler";
import { AppLayout } from "./layout/AppLayout";
import { CameraView } from "./pages/CameraView";
import { Logs } from "./pages/Logs";
import { Testing } from "./pages/Testing";
import { useStore } from "./store/store";
import type { OrdersData, PacketsData } from "./types/data/transformedBoards";
import type { TelemetryData } from "./types/telemetry/telemetry";

function App() {
  const { isConnected } = useWebSocket();
  const { reportError } = useErrorHandler();

  const appMode = useStore((s) => s.appMode);

  const addTelemetry = useStore((s) => s.addTelemetry);

  useTopic<TelemetryData>("podData/update", (data) => {
    addTelemetry(data);
  });

  const {
    data: packets,
    loading: packetsLoading,
    refetch: refetchPackets,
  } = useFetchConfig<PacketsData>("podDataStructure");
  const {
    data: commands,
    loading: commandsLoading,
    refetch: refetchCommands,
  } = useFetchConfig<OrdersData>("orderStructures");

  useEffect(() => {
    if (isConnected && packets !== null && commands !== null) {
      refetchPackets();
      refetchCommands();
    }
  }, [isConnected, refetchPackets, refetchCommands]);

  useAppMode(packets, commands, packetsLoading, commandsLoading, isConnected);

  const transformedBoards = useBoardData(packets, commands, appMode);

  useChartsConfiguration();

  const setPackets = useStore((s) => s.setPackets);
  const setCommands = useStore((s) => s.setCommands);
  const initializeTabFilters = useStore((s) => s.initializeTabFilters);

  useEffect(() => {
    if (!transformedBoards?.packets || !transformedBoards?.commands) return;

    setPackets(transformedBoards.packets);
    setCommands(transformedBoards.commands);
    initializeTabFilters();
  }, [transformedBoards, setPackets, setCommands, initializeTabFilters]);

  // useEffect(() => {
  //   logger.testingView.log("useFetchConfig / podDataStructure", packets);
  //   logger.testingView.log("useFetchConfig / orderStructures", commands);
  //   logger.testingView.log("Transformed boards", transformedBoards);
  // }, [packets, commands, transformedBoards]);

  return (
    <ErrorBoundary onError={reportError}>
      <AppLayout backendConnected={isConnected}>
        <AppModeRouter>
          <Routes>
            <Route path="/" element={<Testing />} />
            <Route path="/logs" element={<Logs />} />
            <Route path="/camera-view" element={<CameraView />} />
          </Routes>
        </AppModeRouter>

        <ModeSwitcher />
      </AppLayout>
    </ErrorBoundary>
  );
}

export default App;
