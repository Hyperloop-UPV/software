import { MOCK_CONNECTIONS } from "../mocks/connections";
import { useStore } from "../store/store";

const useConnections = () => {
  const connections = useStore((s) => s.connections);
  const appMode = useStore((s) => s.appMode);

  if (appMode === "mock") {
    return MOCK_CONNECTIONS;
  }

  return connections;
};

export default useConnections;
