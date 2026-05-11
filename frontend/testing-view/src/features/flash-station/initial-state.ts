import type { FlashStationSnapshot } from "./types"

/**
 * Build a fresh empty snapshot with no data.
 */
export function createInitialFlashStationSnapshot(): FlashStationSnapshot {
  return {
    selectedFile: null,
    selectedFileName: "",
    selectedBoardIds: [],
    boards: [],
    results: [],
    log: [],
    isFlashing: false,
    activeBoardId: null,
  }
}
