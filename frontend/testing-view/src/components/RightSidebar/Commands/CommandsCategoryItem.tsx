import { GenericCategoryItem } from "../Generic/GenericCategoryItem";
import { CommandItem } from "./CommandItem";
import type { BoardName } from "../../../types/BoardName";
// TODO: This component needs to be refactored to use the new store
// For now, commenting out to prevent errors
// import { useCommandsCatalogStore } from "../../../store/useCommandsCatalogStore";
// import { useCommandsFilterStore } from "../../../store/useCommandsFilterStore";

interface CommandsCategoryItemProps {
  category: BoardName;
}

export const CommandsCategoryItem = ({
  category,
}: CommandsCategoryItemProps) => {
  // TODO: Refactor to use new store
  return null; // Temporary - needs refactoring
  // return (
  //   <GenericCategoryItem
  //     category={category}
  //     useCatalogStore={useCommandsCatalogStore}
  //     useFilterStore={useCommandsFilterStore}
  //     ItemComponent={CommandItem}
  //   />
  // );
};
