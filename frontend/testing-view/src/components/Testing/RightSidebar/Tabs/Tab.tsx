import { Button } from "@workspace/ui";
import { ListFilterPlus } from "@workspace/ui/icons";
import { type ComponentType } from "react";
import { useStore } from "../../../../store/store";
import type { Item } from "../../../../types/common/item";
import type { BoardName } from "../../../../types/data/board";
import type { SidebarTab } from "../../../../types/workspace/sidebar";
import { CategoryItem } from "./CategoryItem";
import { EmptyTab } from "./EmptyTab";

interface TabProps {
  title: string;
  scope: SidebarTab;
  categories: readonly BoardName[];
  ItemComponent: ComponentType<{ item: Item }>;
}

export const Tab = ({ title, scope, categories, ItemComponent }: TabProps) => {
  const openFilterDialog = useStore((state) => state.openFilterDialog);
  const totalCount = useStore((state) => state.getTotalCount(scope));
  const filteredCount = useStore((state) => state.getFilteredCount(scope));

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between gap-2 pb-3">
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

      {/* Show empty state when no items are filtered */}
      {filteredCount === 0 ? (
        <EmptyTab title={title} onOpenFilter={() => openFilterDialog(scope)} />
      ) : (
        <div className="space-y-1">
          {categories.map((category) => (
            <CategoryItem
              key={category}
              category={category}
              scope={scope}
              ItemComponent={ItemComponent}
            />
          ))}
        </div>
      )}
    </div>
  );
};
