import { useCommandsStore } from "../../../store/useCommandsStore";
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
  const { toggleExpandedItem, getSelectedByCategory, isItemExpanded } =
    useCommandsStore();

  const visibleCommandIds = getSelectedByCategory(category);
  const allCommands = MOCK_COMMANDS[category];

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
