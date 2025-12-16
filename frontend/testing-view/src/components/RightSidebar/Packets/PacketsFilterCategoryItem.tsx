import { usePacketsStore } from "../../../store/usePacketsStore";
import { MOCK_PACKETS } from "../../../mocks/packets";
import { GenericFilterCategoryItem } from "../Generic/GenericFilterCategoryItem";
import type { PacketsBoardName } from "../../../types/PacketsBoardName";

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

  const packetsBoardCategory = category as PacketsBoardName;

  const allPackets = MOCK_PACKETS[packetsBoardCategory];
  const selectedIds = getSelectedByCategory(packetsBoardCategory);
  const categoryState = getCategoryState(packetsBoardCategory);

  return (
    <GenericFilterCategoryItem
      category={category}
      allItems={allPackets}
      selectedIds={selectedIds}
      categoryState={categoryState}
      onToggleCategory={(checked) =>
        toggleCategory(packetsBoardCategory, checked)
      }
      onToggleItem={(id) => toggleItem(packetsBoardCategory, id)}
    />
  );
};
