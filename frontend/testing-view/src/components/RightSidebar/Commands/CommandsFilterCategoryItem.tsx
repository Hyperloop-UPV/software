import { useCommandsStore } from "../../../store/useCommandsStore";
import { MOCK_COMMANDS } from "../../../mocks/commands";
import { GenericFilterCategoryItem } from "../Generic/GenericFilterCategoryItem";
import type { BoardName } from "../../../types/BoardName";

interface CommandsFilterCategoryItemProps {
  category: BoardName;
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

  const allCommands = MOCK_COMMANDS[category];
  const selectedIds = getSelectedByCategory(category);
  const categoryState = getCategoryState(category);

  return (
    <GenericFilterCategoryItem
      category={category}
      allItems={allCommands}
      selectedIds={selectedIds}
      categoryState={categoryState}
      onToggleCategory={(checked) => toggleCategory(category, checked)}
      onToggleItem={(id) => toggleItem(category, id)}
    />
  );
};
