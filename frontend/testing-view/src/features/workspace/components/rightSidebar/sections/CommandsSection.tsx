import { useStore } from "../../../../../store/store";
import type { CommandCatalogItem } from "../../../../../types/data/commandCatalogItem";
import { CommandItem } from "../tabs/commands/CommandItem";
import { Tab } from "../tabs/Tab";

export const CommandsSection = () => {
  const boards = useStore((s) => s.boards);

  return (
    <Tab
      title="Commands"
      scope="commands"
      categories={boards}
      ItemComponent={(props) => (
        <CommandItem item={props.item as CommandCatalogItem} />
      )}
    />
  );
};
