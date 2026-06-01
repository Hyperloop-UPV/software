import { useWebSocket } from "@workspace/ui/hooks";
import { Route, Routes } from "react-router";
import AppLayout from "./layout/AppLayout";
import Messages from "./pages/Messages";
import Overview from "./pages/Overview";

const App = () => {
  const { isConnected } = useWebSocket();

  return (
    <AppLayout backendConnected={isConnected}>
      <Routes>
        <Route path="/" element={<Overview />} />
        <Route path="/messages" element={<Messages />} />
      </Routes>
    </AppLayout>
  );
};

export default App;
