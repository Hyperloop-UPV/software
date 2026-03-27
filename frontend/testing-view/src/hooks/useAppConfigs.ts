import { useFetchConfig } from "@workspace/ui/hooks";
import { useEffect } from "react";
import { useStore } from "../store/store";
import type { OrdersData, PacketsData } from "../types/data/board";

const useAppConfigs = (isConnected: boolean) => {
  const backendUrl =
    import.meta.env.VITE_BACKEND_URL ?? "http://127.0.0.1:4000/backend";
  const setConfig = useStore((s) => s.setConfig);

  useEffect(() => {
    window.electronAPI?.getConfig().then(setConfig);
  }, [setConfig]);

  const {
    data: packets,
    loading: packetsLoading,
    refetch: refetchPackets,
  } = useFetchConfig<PacketsData>(backendUrl, "podDataStructure");
  const {
    data: commands,
    loading: commandsLoading,
    refetch: refetchCommands,
  } = useFetchConfig<OrdersData>(backendUrl, "orderStructures");

  useEffect(() => {
    if (isConnected) {
      refetchPackets();
      refetchCommands();
    }
  }, [isConnected, refetchPackets, refetchCommands]);

  return {
    packets,
    commands,
    isLoading: packetsLoading || commandsLoading,
  };
};

export default useAppConfigs;
