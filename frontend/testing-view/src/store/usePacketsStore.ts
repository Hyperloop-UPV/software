import { createFilterableStore } from "./createFilterableStore";
import { MOCK_PACKETS } from "../mocks/packets";
import type { PacketsBoardName } from "../types/PacketsBoardName";
import type { Packet } from "../types/Packet";
import { PACKET_BOARD_NAMES } from "../constants/boards";
import { createFullFilter } from "../lib/utils";

export const usePacketsStore = createFilterableStore<PacketsBoardName, Packet>({
  categories: PACKET_BOARD_NAMES,
  dataSource: MOCK_PACKETS,
  defaultFilter: createFullFilter(PACKET_BOARD_NAMES, MOCK_PACKETS),
});
