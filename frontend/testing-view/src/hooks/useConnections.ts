import { MOCK_CONNECTIONS } from "../mocks/connections";
import { useStore } from "../store/store";

const useConnections = () => {
  return useStore((s) =>
    s.appMode === "mock" ? MOCK_CONNECTIONS : s.connections,
  );
};

export default useConnections;
