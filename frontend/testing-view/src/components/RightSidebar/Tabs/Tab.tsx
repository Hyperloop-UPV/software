import { type ComponentType } from "react";
import { Button } from "@workspace/ui";
import { useStore } from "../../../store/store";
import type { SidebarTab } from "../../../types/SidebarTab";
import type { BoardName } from "../../../types/BoardName";
import type { Item } from "../../../types/Item";
import { CategoryItem } from "./CategoryItem";

interface TabProps {
  title: string;
  scope: SidebarTab;
  categories: readonly BoardName[];
  ItemComponent: ComponentType<{ item: Item }>;
}

export const Tab = ({ title, scope, categories, ItemComponent }: TabProps) => {
  const openFilterDialog = useStore((state) => state.openFilterDialog);
  const items = useStore((state) => state[scope]);

  const totalCount = Object.values(items).flat().length;

  const tabFilters = useStore((state) => state.tabFilters);
  const workspaceId = useStore((state) => state.getActiveWorkspaceId());
  if (!workspaceId) return null;

  const filter = tabFilters[workspaceId]?.[scope];
  if (!filter) return null;

  const selectedCommandIds = Object.values(filter).flat();

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 border-b pb-3">
        <h3 className="text-foreground text-lg font-semibold">
          {title}
          <span className="text-muted-foreground ml-2 text-sm font-normal">
            {selectedCommandIds.length} / {totalCount}
          </span>
        </h3>
        <Button
          onClick={() => openFilterDialog(scope)}
          size="sm"
          variant="outline"
        >
          Filter
        </Button>
      </div>

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
    </div>
  );
};
