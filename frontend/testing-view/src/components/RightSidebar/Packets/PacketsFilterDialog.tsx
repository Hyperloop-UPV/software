import { usePacketsStore } from "../../../store/usePacketsStore";
import { PACKET_BOARD_NAMES } from "../../../constants/boards";
import { GenericFilterDialog } from "../Generic/GenericFilterDialog";
import { PacketsFilterCategoryItem } from "./PacketsFilterCategoryItem";

export const PacketsFilterDialog = () => {
  const isFilterDialogOpen = usePacketsStore((s) => s.isFilterDialogOpen);
  const closeFilterDialog = usePacketsStore((s) => s.closeFilterDialog);
  const clearAll = usePacketsStore((s) => s.clearAll);
  const selectAll = usePacketsStore((s) => s.selectAll);

  return (
    <GenericFilterDialog
      title="Filter Packets"
      description="Select which packets to display by ECU category"
      isOpen={isFilterDialogOpen}
      onClose={closeFilterDialog}
      onClearAll={clearAll}
      onSelectAll={selectAll}
      categories={PACKET_BOARD_NAMES}
      FilterCategoryComponent={PacketsFilterCategoryItem}
    />
  );
};
