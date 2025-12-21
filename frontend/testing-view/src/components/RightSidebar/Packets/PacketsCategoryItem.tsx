import { MOCK_PACKETS } from "../../../mocks/packets";
import { GenericCategoryItem } from "../Generic/GenericCategoryItem";
import { PacketItem } from "./PacketItem";
import type { BoardName } from "../../../types/BoardName";

interface PacketsCategoryItemProps {
  category: BoardName;
}

export const PacketsCategoryItem = ({ category }: PacketsCategoryItemProps) => {
  return null;
  // return (
  //   <GenericCategoryItem
  //     category={category}
  //     useCatalogStore={usePacketsCatalogStore}
  //     useFilterStore={usePacketsFilterStore}
  //     ItemComponent={PacketItem}
  //   />
  // );
};
