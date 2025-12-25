import { BOARD_NAMES } from "../../constants/boards";
import { useStore } from "../../store/store";
import { FilterCategoryItem } from "./FilterCategoryItem";
import { FilterDialog } from "./FilterDialog";

export const WorkspaceFilterController = () => {
  const { isOpen, scope } = useStore((s) => s.filterDialog);
  const close = useStore((s) => s.closeFilterDialog);

  const clearFilters = useStore((s) => s.clearFilters);
  const selectAllFilters = useStore((s) => s.selectAllFilters);

  if (!scope) return null;

  return (
    <FilterDialog
      title={`Filter ${scope === "commands" ? "Commands" : "Packets"}`}
      isOpen={isOpen}
      onClose={close}
      onClearAll={() => clearFilters(scope)}
      onSelectAll={() => selectAllFilters(scope)}
      categories={BOARD_NAMES}
      FilterCategoryComponent={FilterCategoryItem}
    />
  );
};
