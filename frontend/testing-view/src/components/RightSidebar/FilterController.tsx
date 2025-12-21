import { BOARD_NAMES } from "../../constants/boards";
import { useStore } from "../../store/store";
import { FilterCategoryItem } from "./FilterCategoryItem";
import { GenericFilterDialog } from "./Generic/GenericFilterDialog";

export const WorkspaceFilterController = () => {
  const { isOpen, scope } = useStore((s) => s.filterDialog);
  const close = useStore((s) => s.closeFilterDialog);

  if (!isOpen || !scope) return null;

  const onClearAll = () => useStore.getState().clearFilters(scope);
  const onSelectAll = () => useStore.getState().selectAllFilters(scope);

  return (
    <GenericFilterDialog
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
