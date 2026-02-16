import { BOARD_NAMES } from "../../../../../constants/boards";
import type { CommandCatalogItem } from "../../../../../types/data/commandCatalogItem";
import { CommandItem } from "../tabs/commands/CommandItem";
import { Tab } from "../tabs/Tab";

export const CommandsSection = () => (
  <Tab
    title="Commands"
    scope="commands"
    categories={BOARD_NAMES}
    ItemComponent={(props) => (
      <CommandItem item={props.item as CommandCatalogItem} />
    )}
  />
);
