import { useTopic, useWebSocket } from "@hyperloop-upv/frontend-kit/hooks";
import { useState } from "react";
import { Route, Routes } from "react-router";
import ErrorBoundary from "./components/ErrorBoundary";
import KeyboardShortcutsHelp from "./components/KeyboardShortcutsHelp";
import {
  BRAKE_ORDERS,
  FAULT_ORDERS,
  OPEN_CONTACTORS_ORDERS,
} from "./constants/orders";
import useKeyboardShortcuts from "./hooks/useKeyboardShortcuts";
import usePodCatalog from "./hooks/usePodCatalog";
import useSendOrder from "./hooks/useSendOrder";
import AppLayout from "./layout/AppLayout";
import Batteries from "./pages/Batteries";
import Messages from "./pages/Messages";
import Overview from "./pages/Overview";
import { useStore } from "./store/store";
import type { Connection } from "./types/connection";
import type { MessagePacket } from "./types/message";
import type { TelemetryData } from "./types/telemetry";

const App = () => {
  const { isConnected } = useWebSocket();

  const updateConnections = useStore((s) => s.updateConnections);
  const addMessage        = useStore((s) => s.addMessage);
  const updateTelemetry   = useStore((s) => s.updateTelemetry);

  const sendOrder = useSendOrder();

  // Fetch pod catalog to build packetId → boardName map for scoped telemetry
  usePodCatalog();

  // Keyboard shortcuts help dialog
  const [helpOpen, setHelpOpen] = useState(false);

  // Global keyboard shortcuts for competition quick-actions.
  // Disabled while the help dialog is open so its keys don't accidentally fire.
  useKeyboardShortcuts({
    enabled:          !helpOpen,
    onBrake:          () => sendOrder(BRAKE_ORDERS),
    onOpenContactors: () => sendOrder(OPEN_CONTACTORS_ORDERS),
    onFault:          () => sendOrder(FAULT_ORDERS),
    onToggleHelp:     () => setHelpOpen((v) => !v),
  });

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
    <>
      <AppLayout
        backendConnected={isConnected}
        onShowShortcuts={() => setHelpOpen(true)}
      >
        <Routes>
          <Route path="/"          element={<ErrorBoundary title="Dashboard failed to render">  <Overview />   </ErrorBoundary>} />
          <Route path="/batteries" element={<ErrorBoundary title="Batteries failed to render">  <Batteries />  </ErrorBoundary>} />
          <Route path="/messages"  element={<ErrorBoundary title="Messages failed to render">   <Messages />   </ErrorBoundary>} />
        </Routes>
      </AppLayout>

      {/* Keyboard shortcuts reference dialog */}
      <KeyboardShortcutsHelp open={helpOpen} onOpenChange={setHelpOpen} />
    </>
  );
};

export default App;
