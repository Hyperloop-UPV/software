import { useStore } from "../store/store";

/**
 * Returns the current board connection map from the global store.
 * Components can subscribe to a specific board by selecting it by name,
 * or consume the full map for a connection-status overview.
 */
const useConnections = () => useStore((s) => s.connections);

export default useConnections;
