import { BOARD_NAMES, MOCK_COMMANDS } from "../mocks/commands";
import { MOCK_PACKETS } from "../mocks/packets";
import type { Tab } from "../types/Tab";
import type {
  CommandsFilterKey,
  PacketsFilterKey,
  TabFilter,
} from "../types/TabFilter";

export const DEFAULT_TABS: Tab[] = [
  { name: "Tab 1", id: "tab-1", description: "Tab 1 description" },
  { name: "Tab 2", id: "tab-2", description: "Tab 2 description" },
  { name: "Tab 3", id: "tab-3", description: "Tab 3 description" },
];

export const DEFAULT_PACKETS_FILTER: TabFilter<PacketsFilterKey> =
  BOARD_NAMES.reduce((acc, boardName) => {
    acc[boardName] = [];
    return acc;
  }, {} as TabFilter<PacketsFilterKey>);

export const PACKETS_FULL_FILTER: TabFilter<PacketsFilterKey> =
  BOARD_NAMES.reduce((acc, boardName) => {
    acc[boardName] = MOCK_PACKETS[boardName].map((packet) => packet.id);
    return acc;
  }, {} as TabFilter<PacketsFilterKey>);

export const DEFAULT_COMMANDS_FILTER: TabFilter<CommandsFilterKey> =
  BOARD_NAMES.reduce((acc, boardName) => {
    acc[boardName] = MOCK_COMMANDS[boardName].map((cmd) => cmd.id);
    return acc;
  }, {} as TabFilter<CommandsFilterKey>);

export const COMMANDS_FULL_FILTER: TabFilter<CommandsFilterKey> =
  BOARD_NAMES.reduce((acc, boardName) => {
    acc[boardName] = MOCK_COMMANDS[boardName].map((cmd) => cmd.id);
    return acc;
  }, {} as TabFilter<CommandsFilterKey>);
