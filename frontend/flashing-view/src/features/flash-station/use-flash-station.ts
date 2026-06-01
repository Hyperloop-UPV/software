import { useEffect, useState, useSyncExternalStore } from "react";
import { createBlcuFlashStationAdapter } from "./blcu-station-adapter";
import type { FlashStationAdapter } from "./types";

/**
 * React hook that bridges the manual observer store to React's concurrent
 * rendering model via useSyncExternalStore.
 *
 * An optional adapter can be passed for testing; production always uses
 * the real BLCU adapter.
 */
export function useFlashStation(adapter?: FlashStationAdapter) {
  const [adapterInstance] = useState(
    () => adapter ?? createBlcuFlashStationAdapter(),
  );

  const snapshot = useSyncExternalStore(
    adapterInstance.subscribe,
    adapterInstance.getSnapshot,
    adapterInstance.getSnapshot,
  );

  // Clean up dangling timers when the component unmounts.
  useEffect(() => {
    return () => adapterInstance.dispose();
  }, [adapterInstance]);

  return {
    ...snapshot,
    setSelectedFile: adapterInstance.setSelectedFile,
    chooseFile: adapterInstance.chooseFile,
    toggleBoard: adapterInstance.toggleBoard,
    selectBoards: adapterInstance.selectBoards,
    reset: adapterInstance.reset,
    startFlash: adapterInstance.startFlash,
  };
}
