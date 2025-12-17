import { usePacketsStore } from "../../../store/usePacketsStore";
import { MOCK_PACKETS } from "../../../mocks/packets";
import { PACKET_BOARD_NAMES } from "../../../constants/boards";
import { GenericTab } from "../Generic/GenericTab";
import { PacketsCategoryItem } from "./PacketsCategoryItem";
import { memo } from "react";

const PacketsTab = () => {
  const { getSelected, openFilterDialog } = usePacketsStore();

  const selectedPacketIds = getSelected();
  const totalPackets = PACKET_BOARD_NAMES.reduce(
    (sum, board) => sum + MOCK_PACKETS[board].length,
    0,
  );

  return (
    <GenericTab
      title="Packets"
      selectedCount={selectedPacketIds.length}
      totalCount={totalPackets}
      onFilterClick={openFilterDialog}
      categories={PACKET_BOARD_NAMES}
      CategoryComponent={PacketsCategoryItem}
    />
  );
};

export default memo(PacketsTab);
