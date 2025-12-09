import { AppLayout } from "./layout/AppLayout";

import { Testing } from "./pages/Testing";
import { Route, Routes } from "react-router";
import { Logs } from "./pages/Logs";
import { CameraView } from "./pages/CameraView";

function App() {
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
