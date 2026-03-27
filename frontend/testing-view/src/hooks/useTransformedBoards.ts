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
  const setBoards = useStore((s) => s.setBoards);
  const initializeWorkspaceFilters = useStore(
    (s) => s.initializeWorkspaceFilters,
  );

  useEffect(() => {
    if (
      !transformedBoards?.telemetryCatalog ||
      !transformedBoards?.commandsCatalog
    )
      return;

    const store = useStore.getState();
    const wasAllCommands = store.isAllSelected("commands");
    const wasAllTelemetry = store.isAllSelected("telemetry");
    const wasAllLogs = store.isAllSelected("logs");

    setTelemetryCatalog(transformedBoards.telemetryCatalog);
    setCommandsCatalog(transformedBoards.commandsCatalog);
    setBoards(Array.from(transformedBoards.boards));

    const hasTelemetryData =
      Object.keys(transformedBoards.telemetryCatalog).length > 0;
    const hasCommandsData =
      Object.keys(transformedBoards.commandsCatalog).length > 0;

    if (hasTelemetryData && hasCommandsData) {
      initializeWorkspaceFilters();
      if (wasAllCommands) useStore.getState().selectAllFilters("commands");
      if (wasAllTelemetry) useStore.getState().selectAllFilters("telemetry");
      if (wasAllLogs) useStore.getState().selectAllFilters("logs");
    }
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
