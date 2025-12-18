import { createFilterableStore } from "./createFilterableStore";
import { MOCK_PACKETS } from "../mocks/packets";
import type { Packet } from "../types/Packet";
import { createFullFilter } from "../lib/utils";

export const usePacketsFilterStore = createFilterableStore<Packet>({
  defaultDataSource: MOCK_PACKETS,
  defaultFilter: createFullFilter,
});
