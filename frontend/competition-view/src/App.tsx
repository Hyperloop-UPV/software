import { useTopic, useWebSocket } from "@workspace/ui/hooks";
import { Route, Routes } from "react-router";
import ErrorBoundary from "./components/ErrorBoundary";
import AppLayout from "./layout/AppLayout";
import Batteries from "./pages/Batteries";
import Boards from "./pages/Boards";
import Charts from "./pages/Charts";
import Messages from "./pages/Messages";
import Orders from "./pages/Orders";
import Overview from "./pages/Overview";
import { useStore } from "./store/store";
import useOrdersCatalog from "./hooks/useOrdersCatalog";
import type { Connection } from "./types/connection";
import type { MessagePacket } from "./types/message";
import type { TelemetryData } from "./types/telemetry";

const App = () => {
  const { isConnected } = useWebSocket();

  const updateConnections = useStore((s) => s.updateConnections);
  const addMessage        = useStore((s) => s.addMessage);
  const updateTelemetry   = useStore((s) => s.updateTelemetry);

  // Fetch and cache the orders catalog; refetches on every reconnect
  useOrdersCatalog(isConnected);

  // Board connection status
  useTopic<Record<string, Connection>>("connection/update", updateConnections);

  // System messages / log entries
  useTopic<MessagePacket>("message/update", (packet) => {
    addMessage({ ...packet, id: crypto.randomUUID() });
  });

  // High-frequency telemetry stream (throttled to 100 ms)
  useTopic<TelemetryData>(
    "podData/update",
    updateTelemetry,
    { downsample: "none", throttle: 100 },
  );

  return (
    <AppLayout backendConnected={isConnected}>
      <Routes>
        <Route path="/"          element={<ErrorBoundary title="Overview failed to render">  <Overview />                          </ErrorBoundary>} />
        <Route path="/charts"    element={<ErrorBoundary title="Charts failed to render">    <Charts />                            </ErrorBoundary>} />
        <Route path="/batteries" element={<ErrorBoundary title="Batteries failed to render"> <Batteries />                         </ErrorBoundary>} />
        <Route path="/boards"    element={<ErrorBoundary title="Boards failed to render">    <Boards />                            </ErrorBoundary>} />
        <Route path="/orders"    element={<ErrorBoundary title="Orders failed to render">    <Orders isConnected={isConnected} />  </ErrorBoundary>} />
        <Route path="/messages"  element={<ErrorBoundary title="Messages failed to render">  <Messages />                          </ErrorBoundary>} />
      </Routes>
    </AppLayout>
  );
};

export default App;
