import { useTopic, useWebSocket } from "@workspace/ui/hooks";
import { Route, Routes } from "react-router";
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
  const addMessage = useStore((s) => s.addMessage);
  const updateTelemetry = useStore((s) => s.updateTelemetry);

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
        <Route path="/" element={<Overview />} />
        <Route path="/charts" element={<Charts />} />
        <Route path="/batteries" element={<Batteries />} />
        <Route path="/boards" element={<Boards />} />
        <Route path="/orders" element={<Orders isConnected={isConnected} />} />
        <Route path="/messages" element={<Messages />} />
      </Routes>
    </AppLayout>
  );
};

export default App;
