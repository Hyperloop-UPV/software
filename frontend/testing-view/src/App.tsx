import { AppLayout } from "./layout/AppLayout";
import { Testing } from "./pages/Testing";
import { Route, Routes } from "react-router";
import { Logs } from "./pages/Logs";
import { CameraView } from "./pages/CameraView";
import { useFetchConfig, useTopic, useWebSocket } from "@workspace/ui/hooks";
import { useEffect } from "react";
import { logger } from "@workspace/core";
import { useStore } from "./store/store";
import { useBoardData } from "./hooks/useBoardData";
import { useAppMode } from "./hooks/useAppMode";
import type { PacketsData } from "./types/AppData";
import type { OrdersData } from "./types/AppData";
import type { TelemtryData } from "./types/Telemetry";

function App() {
  const { isConnected, status } = useWebSocket();

  logger.testingView.log("Status", status);

  const addTelemetry = useStore((s) => s.addTelemetry);

  useTopic<TelemtryData>("podData/update", (data) => {
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
    if (isConnected) {
      refetchPackets();
      refetchCommands();
    }
  }, [isConnected]);

  const appMode = useAppMode(
    packets,
    commands,
    packetsLoading,
    commandsLoading,
    isConnected,
  );

  const transformedBoards = useBoardData(packets, commands, appMode);

  const setPackets = useStore((s) => s.setPackets);
  const setCommands = useStore((s) => s.setCommands);
  const initializeTabFilters = useStore((s) => s.initializeTabFilters);

  useEffect(() => {
    if (!transformedBoards.packets || !transformedBoards.commands) return;

    setPackets(transformedBoards.packets);
    setCommands(transformedBoards.commands);
    initializeTabFilters();
  }, [transformedBoards, setPackets, setCommands, initializeTabFilters]);

  useEffect(() => {
    logger.testingView.log("useFetchConfig / podDataStructure", packets);
    logger.testingView.log("useFetchConfig / orderStructures", commands);
    logger.testingView.log("Transformed boards", transformedBoards);
  }, [packets, commands, transformedBoards]);

  return (
    <AppLayout backendConnected={isConnected}>
      <Routes>
        <Route path="/" element={<Testing />} />
        <Route path="/logs" element={<Logs />} />
        <Route path="/camera-view" element={<CameraView />} />
      </Routes>
    </AppLayout>
  );
}

export default App;
