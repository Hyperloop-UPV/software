import { usePacketsFilterStore } from "../../../store/usePacketsFilterStore";
import { BOARD_NAMES } from "../../../constants/boards";
import { GenericTab } from "../Generic/GenericTab";
import { PacketsCategoryItem } from "./PacketsCategoryItem";
import { memo } from "react";

const PacketsTab = () => {
  const { getSelected, getTotalCount, openFilterDialog } =
    usePacketsFilterStore();

  const selectedPacketIds = getSelected();

  return (
    <GenericTab
      title="Packets"
      selectedCount={selectedPacketIds.length}
      totalCount={getTotalCount()}
      onFilterClick={openFilterDialog}
      categories={BOARD_NAMES}
      CategoryComponent={PacketsCategoryItem}
    />
  );
};

export default memo(PacketsTab);
