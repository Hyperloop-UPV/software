import { Button } from "@workspace/ui";
import { ListFilterPlus } from "@workspace/ui/icons";
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

  return (
    <div className="flex items-center justify-between gap-2 py-4">
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
        className="ring-border/50 hover:ring-primary/30 gap-2 shadow-sm ring-1 transition-all"
      >
        <ListFilterPlus className="h-4 w-4" />
        Filter
      </Button>
    </div>
  );
};
