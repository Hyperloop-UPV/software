import { useEffect, useState, useSyncExternalStore } from "react"

import { createBlcuFlashStationAdapter } from "./blcu-station-adapter"
import type { FlashStationAdapter } from "./types"

function createDefaultAdapter() {
  return createBlcuFlashStationAdapter()
}

/**
 * React hook that bridges our manual store (listeners + snapshot) to React's
 * concurrent rendering model via useSyncExternalStore.
 *
 * You can optionally pass a custom adapter for tests.
 */
export function useFlashStation(adapter?: FlashStationAdapter) {
  const [adapterInstance] = useState(() => adapter ?? createDefaultAdapter())

  const snapshot = useSyncExternalStore(
    adapterInstance.subscribe,
    adapterInstance.getSnapshot,
    adapterInstance.getSnapshot
  )

  // Clean up any dangling timers when the component unmounts so we don't
  // try to update React state after the component is gone.
  useEffect(() => {
    return () => adapterInstance.dispose()
  }, [adapterInstance])

  return {
    ...snapshot,
    setSelectedFile: adapterInstance.setSelectedFile,
    chooseFile: adapterInstance.chooseFile,
    toggleBoard: adapterInstance.toggleBoard,
    selectBoards: adapterInstance.selectBoards,
    reset: adapterInstance.reset,
    startFlash: adapterInstance.startFlash,
  }
}
