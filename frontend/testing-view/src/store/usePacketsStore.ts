import { createFilterableStore } from "./createFilterableStore";
import { MOCK_PACKETS } from "../mocks/packets";
import type { PacketsBoardName } from "../types/TabFilter";
import type { Packet } from "../types/Packet";
import { PACKET_BOARD_NAMES } from "../constants/boards";

export const usePacketsStore = createFilterableStore<PacketsBoardName, Packet>({
  categories: PACKET_BOARD_NAMES,
  getMockData: () => MOCK_PACKETS,
});
