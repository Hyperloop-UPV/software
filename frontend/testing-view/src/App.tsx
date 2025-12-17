import { AppLayout } from "./layout/AppLayout";

import { Testing } from "./pages/Testing";
import { Route, Routes } from "react-router";
import { Logs } from "./pages/Logs";
import { CameraView } from "./pages/CameraView";
import { useFetchConfig, useWebSocket } from "@workspace/ui/hooks";
import { useEffect } from "react";
import { logger } from "@workspace/core";

function App() {
  useWebSocket();

  const { data: boards } = useFetchConfig("uploadableBoards");
  const { data: packets } = useFetchConfig("podDataStructure");
  const { data: commands } = useFetchConfig("orderStructures");

  useEffect(() => {
    logger.testingView.log("useFetchConfig / uploadableBoards", boards);
    logger.testingView.log("useFetchConfig / podDataStructure", packets);
    logger.testingView.log("useFetchConfig / orderStructures", commands);
  }, [boards, packets, commands]);

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Testing />} />
        <Route path="/logs" element={<Logs />} />
        <Route path="/camera-view" element={<CameraView />} />
      </Routes>
    </AppLayout>
  );
}

export default App;
