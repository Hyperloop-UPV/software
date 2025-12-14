import { useCommandsStore } from "../../../store/useCommandsStore";
import { MOCK_COMMANDS } from "../../../mocks/commands";
import { GenericFilterCategoryItem } from "../Generic/GenericFilterCategoryItem";
import type { BoardName } from "../../../types/BoardName";

interface CommandsFilterCategoryItemProps {
  category: string;
}

export const CommandsFilterCategoryItem = ({
  category,
}: CommandsFilterCategoryItemProps) => {
  const {
    getSelectedByCategory,
    getCategoryState,
    toggleCategory,
    toggleItem,
  } = useCommandsStore();

  const boardCategory = category as BoardName;

  const allCommands = MOCK_COMMANDS[boardCategory];
  const selectedIds = getSelectedByCategory(boardCategory);
  const categoryState = getCategoryState(boardCategory);

  return (
    <GenericFilterCategoryItem
      category={category}
      allItems={allCommands}
      selectedIds={selectedIds}
      categoryState={categoryState}
      onToggleCategory={(checked) => toggleCategory(boardCategory, checked)}
      onToggleItem={(id) => toggleItem(boardCategory, id)}
    />
  );
};
