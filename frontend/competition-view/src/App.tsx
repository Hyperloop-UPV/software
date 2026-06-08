import { useTopic, useWebSocket } from "@workspace/ui/hooks";
import { useState } from "react";
import { Route, Routes } from "react-router";
import ErrorBoundary from "./components/ErrorBoundary";
import KeyboardShortcutsHelp from "./components/KeyboardShortcutsHelp";
import {
  BRAKE_ORDERS,
  EMERGENCY_STOP_ORDERS,
  OPEN_CONTACTORS_ORDERS,
} from "./constants/orders";
import useKeyboardShortcuts from "./hooks/useKeyboardShortcuts";
import useSendOrder from "./hooks/useSendOrder";
import AppLayout from "./layout/AppLayout";
import Batteries from "./pages/Batteries";
import Boards from "./pages/Boards";
import Charts from "./pages/Charts";
import Messages from "./pages/Messages";
import Orders from "./pages/Orders";
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

  // Keyboard shortcuts help dialog
  const [helpOpen, setHelpOpen] = useState(false);

  // Global keyboard shortcuts for competition quick-actions.
  // Disabled while the help dialog is open so its keys don't accidentally fire.
  const { estopArmed } = useKeyboardShortcuts({
    enabled:          !helpOpen,
    onBrake:          () => sendOrder(BRAKE_ORDERS),
    onOpenContactors: () => sendOrder(OPEN_CONTACTORS_ORDERS),
    onEmergencyStop:  () => sendOrder(EMERGENCY_STOP_ORDERS),
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
          <Route path="/"          element={<ErrorBoundary title="Overview failed to render">  <Overview />                          </ErrorBoundary>} />
          <Route path="/charts"    element={<ErrorBoundary title="Charts failed to render">    <Charts />                            </ErrorBoundary>} />
          <Route path="/batteries" element={<ErrorBoundary title="Batteries failed to render"> <Batteries />                         </ErrorBoundary>} />
          <Route path="/boards"    element={<ErrorBoundary title="Boards failed to render">    <Boards />                            </ErrorBoundary>} />
          <Route path="/orders"    element={<ErrorBoundary title="Orders failed to render">    <Orders />                            </ErrorBoundary>} />
          <Route path="/messages"  element={<ErrorBoundary title="Messages failed to render">  <Messages />                          </ErrorBoundary>} />
        </Routes>
      </AppLayout>

      {/* Keyboard shortcuts reference dialog */}
      <KeyboardShortcutsHelp open={helpOpen} onOpenChange={setHelpOpen} />

      {/* ESTOP armed banner — pulses for 2 s after the first E press */}
      {estopArmed && (
        <div className="animate-pulse fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-red-600 px-6 py-3 text-sm font-bold text-white shadow-xl">
          ⚠ ESTOP ARMED — Press E again to confirm
        </div>
      )}
    </>
  );
};

export default App;
