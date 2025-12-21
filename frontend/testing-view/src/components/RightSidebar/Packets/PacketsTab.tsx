import { BOARD_NAMES } from "../../../constants/boards";
import { GenericTab } from "../Generic/GenericTab";
import { PacketsCategoryItem } from "./PacketsCategoryItem";

const PacketsTab = () => {
  return (
    <GenericTab
      title="Packets"
      scope="packets"
      categories={BOARD_NAMES}
      CategoryComponent={PacketsCategoryItem}
    />
  );
};

export default PacketsTab;
