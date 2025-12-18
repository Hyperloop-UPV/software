import { usePacketsFilterStore } from "../../../store/usePacketsFilterStore";
import { MOCK_PACKETS } from "../../../mocks/packets";
import { BOARD_NAMES } from "../../../constants/boards";
import { GenericTab } from "../Generic/GenericTab";
import { PacketsCategoryItem } from "./PacketsCategoryItem";
import { memo } from "react";
import { useShallow } from "zustand/shallow";

const PacketsTab = () => {
  const { getSelected, getTotalCount, openFilterDialog } =
    usePacketsFilterStore(
      useShallow((state) => ({
        getSelected: state.getSelected,
        getTotalCount: state.getTotalCount,
        openFilterDialog: state.openFilterDialog,
      })),
    );

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
