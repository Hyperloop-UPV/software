import { useCommandsFilterStore } from "../../../store/useCommandsFilterStore";
import { MOCK_COMMANDS } from "../../../mocks/commands";
import { GenericCategoryItem } from "../Generic/GenericCategoryItem";
import { CommandItem } from "./CommandItem";
import type { BoardName } from "../../../types/BoardName";

interface CommandsCategoryItemProps {
  category: BoardName;
}

export const CommandsCategoryItem = ({
  category,
}: CommandsCategoryItemProps) => {
  const {
    toggleExpandedItem,
    getSelectedByCategory,
    isItemExpanded,
    getItemsByCategory,
  } = useCommandsFilterStore();

  const visibleCommandIds = getSelectedByCategory(category);
  const allCommands = getItemsByCategory(category);

  const selectedCommands = allCommands.filter((cmd) =>
    visibleCommandIds.includes(cmd.id),
  );

  return (
    <GenericCategoryItem
      category={category}
      items={selectedCommands}
      ItemComponent={CommandItem}
      isExpanded={isItemExpanded(category)}
      onToggleExpanded={() => toggleExpandedItem(category)}
    />
  );
};
