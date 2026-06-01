import type { Board, BoardState, FlashStationSnapshot } from "./types";

/** Human-readable labels shown under each board card. */
export const BOARD_STATUS_LABEL: Record<BoardState, string> = {
  connected: "CONNECTED",
  offline: "OFFLINE",
};

/** Returns the filename if one is selected, otherwise a friendly placeholder. */
export function getSelectedFileLabel(snapshot: FlashStationSnapshot): string {
  return snapshot.selectedFileName || "No file selected";
}

/**
 * What text to show under a board's status dot.
 *
 * When a flash is in progress we highlight the actively-flashing board with
 * "FLASHING"; everything else shows its connection state.
 */
export function getBoardDisplayStatus(
  board: Board,
  activeBoardId: string | null,
  isFlashing: boolean,
): string {
  if (isFlashing && activeBoardId === board.id) {
    return "FLASHING";
  }
  return BOARD_STATUS_LABEL[board.state];
}

/** IDs of every board whose state is "connected". */
export function getConnectedBoardIds(boards: Board[]): string[] {
  return boards
    .filter((board) => board.state === "connected")
    .map((board) => board.id);
}

/** Simple count of online boards for the badge in the top-right. */
export function getConnectedBoardCount(boards: Board[]): number {
  return boards.filter((board) => board.state === "connected").length;
}

/**
 * Crude firmware-to-board compatibility check.
 *
 * We strip "STM32" from the MCU name (e.g. "STM32F405" → "f405") and see if
 * that token appears anywhere in the filename. We also accept files that
 * contain "all" as a catch-all wildcard.
 */
export function isBoardCompatible(board: Board, fileName: string): boolean {
  if (!fileName) return false;
  const normalizedFileName = fileName.toLowerCase();
  const mcuToken = board.mcu.toLowerCase().replace("stm32", "");
  return (
    normalizedFileName.includes("all") ||
    normalizedFileName.includes(mcuToken)
  );
}
