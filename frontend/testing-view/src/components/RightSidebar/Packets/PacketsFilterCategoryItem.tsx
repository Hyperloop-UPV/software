import { usePacketsStore } from "../../../store/usePacketsStore";
import { MOCK_PACKETS } from "../../../mocks/packets";
import { GenericFilterCategoryItem } from "../Generic/GenericFilterCategoryItem";
import type { PacketsBoardName } from "../../../types/TabFilter";

interface PacketsFilterCategoryItemProps {
  category: string;
}

export const PacketsFilterCategoryItem = ({
  category,
}: PacketsFilterCategoryItemProps) => {
  const {
    getSelectedByCategory,
    getCategoryState,
    toggleCategory,
    toggleItem,
  } = usePacketsStore();

  const allPackets = MOCK_PACKETS[category as PacketsBoardName];
  const selectedIds = getSelectedByCategory(category as PacketsBoardName);
  const categoryState = getCategoryState(category as PacketsBoardName);

  return (
    <GenericFilterCategoryItem
      category={category}
      allItems={allPackets}
      selectedIds={selectedIds}
      categoryState={categoryState}
      onToggleCategory={(checked) =>
        toggleCategory(category as PacketsBoardName, checked)
      }
      onToggleItem={(id) => toggleItem(category as PacketsBoardName, id)}
    />
  );
};
