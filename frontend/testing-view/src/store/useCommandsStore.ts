import { createFilterableStore } from "./createFilterableStore";
import { BOARD_NAMES, MOCK_COMMANDS } from "../mocks/commands";
import type { BoardName } from "../types/BoardName";
import type { Command } from "../types/Command";

export const useCommandsStore = createFilterableStore<BoardName, Command>({
  categories: BOARD_NAMES,
  getMockData: () => MOCK_COMMANDS,
});
