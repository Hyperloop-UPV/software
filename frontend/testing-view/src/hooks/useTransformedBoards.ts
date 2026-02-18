import { useEffect } from "react";
import { useStore } from "../store/store";
import type { OrdersData, PacketsData } from "../types/data/board";
import { useBoardData } from "./useBoardData";

export function useTransformedBoards(
  packets: PacketsData | null,
  commands: OrdersData | null,
) {
  const appMode = useStore((s) => s.appMode);
  const transformedBoards = useBoardData(packets, commands, appMode);

  const setTelemetryCatalog = useStore((s) => s.setTelemetryCatalog);
  const setCommandsCatalog = useStore((s) => s.setCommandsCatalog);
  const initializeWorkspaceFilters = useStore(
    (s) => s.initializeWorkspaceFilters,
  );

  useEffect(() => {
    if (
      !transformedBoards?.telemetryCatalog ||
      !transformedBoards?.commandsCatalog
    )
      return;

    setTelemetryCatalog(transformedBoards.telemetryCatalog);
    setCommandsCatalog(transformedBoards.commandsCatalog);
    initializeWorkspaceFilters();
  }, [
    transformedBoards,
    setTelemetryCatalog,
    setCommandsCatalog,
    initializeWorkspaceFilters,
  ]);

  // Debug logs
  //   useEffect(() => {
  //     logger.testingView.log("[DEBUG] useFetchConfig / podDataStructure", packets);
  //     logger.testingView.log("[DEBUG] useFetchConfig / orderStructures", commands);
  //     logger.testingView.log("[DEBUG] Transformed boards", transformedBoards);
  //   }, [packets, commands, transformedBoards]);
}
