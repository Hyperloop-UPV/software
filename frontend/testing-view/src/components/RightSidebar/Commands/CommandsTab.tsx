import { GenericTab } from "../Generic/GenericTab";
import { CommandsCategoryItem } from "./CommandsCategoryItem";
import { BOARD_NAMES } from "../../../constants/boards";

export const CommandsTab = () => {
  return (
    <GenericTab
      title="Commands"
      scope="commands"
      categories={BOARD_NAMES}
      CategoryComponent={CommandsCategoryItem}
    />
  );
};
