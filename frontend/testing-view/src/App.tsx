import { useTopic, useWebSocket } from "@workspace/ui/hooks";
import { Route, Routes } from "react-router";
import { AppModeRouter } from "./components/AppModeRouter";
import { ModeSwitcher } from "./components/DevTools/ModeSwitcher";
import { ErrorBoundary } from "./components/ErrorBoundary";
import useAppConfigs from "./hooks/useAppConfigs";
import { useAppMode } from "./hooks/useAppMode";
import { useChartsConfiguration } from "./hooks/useChartsConfiguration";
import { useErrorHandler } from "./hooks/useErrorHandler";
import { useTransformedBoards } from "./hooks/useTransformedBoards";
import { AppLayout } from "./layout/AppLayout";
import { CameraView } from "./pages/CameraView";
import { Logs } from "./pages/Logs";
import { Testing } from "./pages/Testing";
import { useStore } from "./store/store";
import type { TelemetryData } from "./types/telemetry/telemetry";

function App() {
  const { isConnected } = useWebSocket();
  const { reportError } = useErrorHandler();

  const addTelemetry = useStore((s) => s.addTelemetry);

  // Fetch app configs
  const { packets, commands, isLoading } = useAppConfigs(isConnected);

  // Determine app mode
  useAppMode(packets, commands, isLoading, isConnected);

  // Transform boards and store in the global store
  useTransformedBoards(packets, commands);

  // Restore charts configuration
  useChartsConfiguration();

  // Subscribe to telemetry updates
  useTopic<TelemetryData>("podData/update", (data) => {
    addTelemetry(data);
  });

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
