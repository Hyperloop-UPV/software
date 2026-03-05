import { useShallow } from "zustand/shallow";
import { detectExtraBoards } from "../../../lib/utils";
import { useStore } from "../../../store/store";
import { FilterCategoryItem } from "./FilterCategoryItem";
import { FilterDialog } from "./FilterDialog";

export const FilterController = () => {
  const { isOpen, scope } = useStore((s) => s.filterDialog);
  const close = useStore((s) => s.closeFilterDialog);

  const boards = useStore((s) => s.boards);
  const activeFilters = useStore(useShallow((s) => s.getActiveFilters(scope)));

  const clearFilters = useStore((s) => s.clearFilters);
  const selectAllFilters = useStore((s) => s.selectAllFilters);

  if (!scope) return null;

  const extraBoards = detectExtraBoards(activeFilters, boards);

  return (
    <FilterDialog
      title={`Filter ${scope === "commands" ? "commands" : "telemetry packets"}`}
      description={`Filter ${scope === "commands" ? "commands" : "packets"} by category`}
      isOpen={isOpen}
      onClose={close}
      onClearAll={() => clearFilters(scope)}
      onSelectAll={() => selectAllFilters(scope)}
      categories={boards}
      extraCategories={extraBoards}
      FilterCategoryComponent={FilterCategoryItem}
    />
  );
};
