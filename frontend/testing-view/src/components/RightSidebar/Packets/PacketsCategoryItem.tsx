import { usePacketsFilterStore } from "../../../store/usePacketsFilterStore";
import { MOCK_PACKETS } from "../../../mocks/packets";
import { GenericCategoryItem } from "../Generic/GenericCategoryItem";
import { PacketItem } from "./PacketItem";
import type { BoardName } from "../../../types/BoardName";

interface PacketsCategoryItemProps {
  category: BoardName;
}

export const PacketsCategoryItem = ({ category }: PacketsCategoryItemProps) => {
  const {
    isItemExpanded,
    toggleExpandedItem,
    getSelectedByCategory,
    getItemsByCategory,
  } = usePacketsFilterStore();

  const selectedPacketIds = getSelectedByCategory(category);
  const allPackets = getItemsByCategory(category);

  const selectedPackets = allPackets.filter((pkt) =>
    selectedPacketIds.includes(pkt.id),
  );

  return (
    <GenericCategoryItem
      category={category}
      items={selectedPackets}
      ItemComponent={PacketItem}
      isExpanded={isItemExpanded(category)}
      onToggleExpanded={() => toggleExpandedItem(category)}
    />
  );
};
