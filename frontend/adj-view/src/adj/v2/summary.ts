import { extractBoards } from "./AdjViewerTabs";
import type { AdjArchiveV2 } from "./types";

export function summarizeV2(data: AdjArchiveV2) {
  const boards = extractBoards(data);
  return {
    boards: boards.length,
    measurements: boards.reduce((s, b) => s + b.measurements.length, 0),
    packets: boards.reduce((s, b) => s + b.packets.length + b.orders.length, 0),
  };
}
