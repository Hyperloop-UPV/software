import { connect } from "@workspace/core";
import { useCallback, useEffect } from "react";
import { AppLayout } from "./layout/AppLayout";

import { Testing } from "./pages/Testing";
import { Route, Routes, useLocation } from "react-router";
import { Logs } from "./pages/Logs";
import { CameraView } from "./pages/CameraView";

function App() {
  const connectToWebSocket = useCallback(() => {
    console.time("[TEST] connect to websocket");
    connect();
    console.timeEnd("[TEST] connect to websocket");
  }, []);

  useEffect(() => {
    connectToWebSocket();
  }, [connectToWebSocket]);

  const location = useLocation();

  // Map routes to page names
  const pageNames: Record<string, string> = {
    "/": "Testing",
    "/logs": "Logs",
    "/camera-view": "Camera View",
  };

  return (
    <AppLayout pageName={pageNames[location.pathname] || "Page"}>
      <Routes>
        <Route path="/" element={<Testing />} />
        <Route path="/logs" element={<Logs />} />
        <Route path="/camera-view" element={<CameraView />} />
      </Routes>
    </AppLayout>
  );
}

export default App;
