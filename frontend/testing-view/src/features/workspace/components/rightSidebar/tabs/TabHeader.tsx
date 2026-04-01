import { Button } from "@workspace/ui";
import { AlertTriangle, ListFilterPlus } from "@workspace/ui/icons";
import { useShallow } from "zustand/shallow";
import { detectExtraBoards } from "../../../../../lib/utils";
import { useStore } from "../../../../../store/store";
import type { SidebarTab } from "../../../types/sidebar";

interface TabHeaderProps {
  title: string;
  scope: SidebarTab;
}

export const TabHeader = ({ title, scope }: TabHeaderProps) => {
  const openFilterDialog = useStore((state) => state.openFilterDialog);
  const totalCount = useStore((state) => state.getTotalCount(scope));
  const filteredCount = useStore((state) => state.getFilteredCount(scope));

  const boards = useStore((s) => s.boards);
  const activeFilters = useStore(useShallow((s) => s.getActiveFilters(scope)));
  const extraBoards = detectExtraBoards(activeFilters, boards);

  return (
    <div className="flex flex-col gap-1 py-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-foreground text-lg font-semibold">
          {title}
          <span className="text-muted-foreground ml-2 text-sm font-normal">
            {filteredCount} / {totalCount}
          </span>
        </h3>
        <Button
          onClick={() => openFilterDialog(scope)}
          size="sm"
          variant="secondary"
          data-testid={`filter-button-${scope}`}
          className="ring-border/50 hover:ring-primary/30 gap-2 shadow-sm ring-1 transition-all"
        >
          <ListFilterPlus className="h-4 w-4" />
          Filter
        </Button>
      </div>

      {/* Warning for stale boards */}
      {extraBoards.length > 0 && (
        <div
          className="flex cursor-help items-center gap-1.5 text-[11px] font-medium text-amber-500"
          title={`Stale boards in filters: ${extraBoards.join(", ")}`}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>{extraBoards.length} stale board(s) affecting counts</span>
        </div>
      )}
    </div>
  );
};
