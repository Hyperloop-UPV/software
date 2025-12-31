import { useEffect } from "react";
import { useStore } from "../store/store";
import type { OrdersData, PacketsData } from "../types/data/transformedBoards";
import { useBoardData } from "./useBoardData";

export function useTransformedBoards(
  packets: PacketsData | null,
  commands: OrdersData | null,
) {
  const appMode = useStore((s) => s.appMode);
  const transformedBoards = useBoardData(packets, commands, appMode);

  const setPackets = useStore((s) => s.setPackets);
  const setCommands = useStore((s) => s.setCommands);
  const initializeTabFilters = useStore((s) => s.initializeTabFilters);

  useEffect(() => {
    if (!transformedBoards?.packets || !transformedBoards?.commands) return;

    setPackets(transformedBoards.packets);
    setCommands(transformedBoards.commands);
    initializeTabFilters();
  }, [transformedBoards, setPackets, setCommands, initializeTabFilters]);

  // Debug logs
  //   useEffect(() => {
  //     logger.testingView.log("[DEBUG] useFetchConfig / podDataStructure", packets);
  //     logger.testingView.log("[DEBUG] useFetchConfig / orderStructures", commands);
  //     logger.testingView.log("[DEBUG] Transformed boards", transformedBoards);
  //   }, [packets, commands, transformedBoards]);
}
