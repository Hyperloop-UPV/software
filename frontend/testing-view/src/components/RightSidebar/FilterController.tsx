import { BOARD_NAMES } from "../../constants/boards";
import { useStore } from "../../store/store";
import { FilterCategoryItem } from "./FilterCategoryItem";
import { FilterDialog } from "./Generic/FilterDialog";

export const WorkspaceFilterController = () => {
  const { isOpen, scope } = useStore((s) => s.filterDialog);
  const close = useStore((s) => s.closeFilterDialog);

  if (!isOpen || !scope) return null;

  const onClearAll = () => useStore.getState().clearFilters(scope);
  const onSelectAll = () => useStore.getState().selectAllFilters(scope);

  return (
    <FilterDialog
      title={`Filter ${scope === "commands" ? "Commands" : "Packets"}`}
      isOpen={isOpen}
      onClose={close}
      onClearAll={onClearAll}
      onSelectAll={onSelectAll}
      categories={BOARD_NAMES}
      FilterCategoryComponent={FilterCategoryItem}
    />
  );
};
