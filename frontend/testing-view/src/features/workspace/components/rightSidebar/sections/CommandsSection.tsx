import { useStore } from "../../../../../store/store";
import type { CatalogItem } from "../../../../../types/common/item";
import type { CommandCatalogItem } from "../../../../../types/data/commandCatalogItem";
import { CommandItem } from "../tabs/commands/CommandItem";
import { Tab } from "../tabs/Tab";

const CommandItemWrapper = ({ item }: { item: CatalogItem }) => (
  <CommandItem item={item as CommandCatalogItem} />
);

export const CommandsSection = () => {
  const boards = useStore((s) => s.boards);

  return (
    <Tab
      title="Commands"
      scope="commands"
      categories={boards}
      ItemComponent={CommandItemWrapper}
    />
  );
};
