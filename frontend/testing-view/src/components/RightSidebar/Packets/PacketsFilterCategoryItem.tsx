import { usePacketsFilterStore } from "../../../store/usePacketsFilterStore";
import { MOCK_PACKETS } from "../../../mocks/packets";
import { GenericFilterCategoryItem } from "../Generic/GenericFilterCategoryItem";
import type { BoardName } from "../../../types/BoardName";

interface PacketsFilterCategoryItemProps {
  category: BoardName;
}

export const PacketsFilterCategoryItem = ({
  category,
}: PacketsFilterCategoryItemProps) => {
  const {
    getSelectedByCategory,
    getCategoryState,
    toggleCategory,
    toggleItem,
    getItemsByCategory,
  } = usePacketsFilterStore();

  const allPackets = getItemsByCategory(category);
  const selectedIds = getSelectedByCategory(category);
  const categoryState = getCategoryState(category);

  return (
    <GenericFilterCategoryItem
      category={category}
      allItems={allPackets}
      selectedIds={selectedIds}
      categoryState={categoryState}
      onToggleCategory={(checked) => toggleCategory(category, checked)}
      onToggleItem={(id) => toggleItem(category, id)}
    />
  );
};
