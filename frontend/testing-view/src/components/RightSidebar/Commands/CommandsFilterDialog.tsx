import { useCommandsFilterStore } from "../../../store/useCommandsFilterStore";
import { BOARD_NAMES } from "../../../constants/boards";
import { GenericFilterDialog } from "../Generic/GenericFilterDialog";
import { CommandsFilterCategoryItem } from "./CommandsFilterCategoryItem";

export const CommandsFilterDialog = () => {
  const { isFilterDialogOpen, closeFilterDialog, clearAll, selectAll } =
    useCommandsFilterStore();

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
