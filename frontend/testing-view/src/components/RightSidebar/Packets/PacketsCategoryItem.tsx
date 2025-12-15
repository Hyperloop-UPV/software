import { usePacketsStore } from "../../../store/usePacketsStore";
import { MOCK_PACKETS } from "../../../mocks/packets";
import { GenericCategoryItem } from "../Generic/GenericCategoryItem";
import { PacketItem } from "./PacketItem";
import type { PacketsBoardName } from "../../../types/TabFilter";

interface PacketsCategoryItemProps {
  category: PacketsBoardName;
}

export const PacketsCategoryItem = ({ category }: PacketsCategoryItemProps) => {
  const { getSelectedByCategory, isItemExpanded, toggleExpandedItem } =
    usePacketsStore();

  const selectedPacketIds = getSelectedByCategory(category);
  const allPackets = MOCK_PACKETS[category];

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
