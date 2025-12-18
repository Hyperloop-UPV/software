import { createFilterableStore } from "./createFilterableStore";
import { MOCK_COMMANDS } from "../mocks/commands";
import type { Command } from "../types/Command";
import { createFullFilter } from "../lib/utils";

export const useCommandsFilterStore = createFilterableStore<Command>({
  defaultDataSource: MOCK_COMMANDS,
  defaultFilter: createFullFilter,
});
