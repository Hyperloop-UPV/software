import { useCommandsStore } from "../../../store/useCommandsStore";
import { BOARD_NAMES, MOCK_COMMANDS } from "../../../mocks/commands";
import { GenericTab } from "../Generic/GenericTab";
import { CommandsCategoryItem } from "./CommandsCategoryItem";

export const CommandsTab = () => {
  const { getSelected, openFilterDialog } = useCommandsStore();

  const selectedCommandIds = getSelected();
  const totalCommands = BOARD_NAMES.reduce(
    (sum, board) => sum + MOCK_COMMANDS[board].length,
    0,
  );

  return (
    <GenericTab
      title="Commands"
      selectedCount={selectedCommandIds.length}
      totalCount={totalCommands}
      onFilterClick={openFilterDialog}
      categories={BOARD_NAMES}
      CategoryComponent={CommandsCategoryItem}
    />
  );
};
