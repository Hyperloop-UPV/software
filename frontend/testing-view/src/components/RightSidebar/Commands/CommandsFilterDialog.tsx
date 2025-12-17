import { useCommandsStore } from "../../../store/useCommandsStore";
import { BOARD_NAMES } from "../../../mocks/commands";
import { GenericFilterDialog } from "../Generic/GenericFilterDialog";
import { CommandsFilterCategoryItem } from "./CommandsFilterCategoryItem";

export const CommandsFilterDialog = () => {
  const isFilterDialogOpen = useCommandsStore((s) => s.isFilterDialogOpen);
  const closeFilterDialog = useCommandsStore((s) => s.closeFilterDialog);
  const clearAll = useCommandsStore((s) => s.clearAll);
  const selectAll = useCommandsStore((s) => s.selectAll);

  return (
    <GenericFilterDialog
      title="Filter Commands"
      description="Select which commands to display by ECU category"
      isOpen={isFilterDialogOpen}
      onClose={closeFilterDialog}
      onClearAll={clearAll}
      onSelectAll={selectAll}
      categories={BOARD_NAMES}
      FilterCategoryComponent={CommandsFilterCategoryItem}
    />
  );
};
