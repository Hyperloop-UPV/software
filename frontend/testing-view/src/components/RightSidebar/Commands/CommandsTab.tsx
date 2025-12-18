import { useCommandsFilterStore } from "../../../store/useCommandsFilterStore";
import { GenericTab } from "../Generic/GenericTab";
import { CommandsCategoryItem } from "./CommandsCategoryItem";
import { BOARD_NAMES } from "../../../constants/boards";

export const CommandsTab = () => {
  const { getSelected, getTotalCount, openFilterDialog } =
    useCommandsFilterStore();

  const selectedCommandIds = getSelected();

  return (
    <GenericTab
      title="Commands"
      selectedCount={selectedCommandIds.length}
      totalCount={getTotalCount()}
      onFilterClick={openFilterDialog}
      categories={BOARD_NAMES}
      CategoryComponent={CommandsCategoryItem}
    />
  );
};
