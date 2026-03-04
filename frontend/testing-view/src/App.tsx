import { useTopic, useWebSocket } from "@workspace/ui/hooks";
import { Route, Routes } from "react-router";
import { AppModeRouter } from "./components/AppModeRouter";
import { ModeSwitcher } from "./components/devTools/ModeSwitcher";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { useChartsConfiguration } from "./features/charts/hooks/useChartsConfiguration";
import { FilterController } from "./features/filtering/components/FilterController";
import useAppConfigs from "./hooks/useAppConfigs";
import { useAppMode } from "./hooks/useAppMode";
import { useErrorHandler } from "./hooks/useErrorHandler";
import { useTransformedBoards } from "./hooks/useTransformedBoards";
import { AppLayout } from "./layout/AppLayout";
import { Logs } from "./pages/Logs";
import { Testing } from "./pages/Testing";
import { useStore } from "./store/store";
import type { Connection } from "./types/common/connection";
import type { MessagePacket } from "./types/data/message";
import type { TelemetryData } from "./types/telemetry/telemetry";

function App() {
  const { isConnected } = useWebSocket();
  const { reportError } = useErrorHandler();

  // Fetch app configs
  const { packets, commands, isLoading } = useAppConfigs(isConnected);

  // Determine app mode
  useAppMode(packets, commands, isLoading);

  // Transform boards and store in the global store
  useTransformedBoards(packets, commands);

  // Restore charts configuration
  useChartsConfiguration();

  // Callback executed when telemetry data is received
  const addTelemetry = useStore((s) => s.addTelemetry);

  // Subscribe to telemetry updates
  useTopic<TelemetryData>(
    "podData/update",
    (data) => {
      addTelemetry(data);
    },
    { downsample: "none", throttle: 100 },
  );

  // Callback executed when connection updates are received
  const updateConnections = useStore((s) => s.updateConnections);

  // Subscribe to connection updates
  useTopic<Record<string, Connection>>("connection/update", (data) => {
    updateConnections(data);
  });

  // Callback executed when messages are received
  const addMessage = useStore((s) => s.addMessage);

  useTopic<MessagePacket>("message/update", (data) => {
    console.log("Message received:", data);
    addMessage({
      ...data,
      id: crypto.randomUUID(),
    });
  });

  return (
    <ErrorBoundary onError={reportError}>
      <AppLayout backendConnected={isConnected}>
        <FilterController />

        <AppModeRouter>
          <Routes>
            <Route path="/" element={<Testing />} />
            <Route path="/logs" element={<Logs />} />
          </Routes>
        </AppModeRouter>
        <ModeSwitcher />
      </AppLayout>
    </ErrorBoundary>
  );
}

export default App;
