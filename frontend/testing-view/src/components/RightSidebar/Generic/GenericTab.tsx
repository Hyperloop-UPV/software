import { type ComponentType } from "react";
import { Button } from "@workspace/ui";
import { useStore } from "../../../store/store";
import type { FilterScope } from "../../../store/slices/workspacesSlice";
import type { SidebarTab } from "../../../types/SidebarTab";

interface GenericTabProps<TCategory extends string> {
  title: string;
  scope: SidebarTab;
  categories: readonly TCategory[];
  CategoryComponent: ComponentType<{ category: TCategory }>;
}

export const GenericTab = <TCategory extends string>({
  title,
  scope,
  categories,
  CategoryComponent,
}: GenericTabProps<TCategory>) => {
  const openFilterDialog = useStore((state) => state.openFilterDialog);
  const items = useStore((state) => state[scope]);

  const totalCount = Object.values(items).flat().length;

  const tabFilters = useStore((state) => state.tabFilters);
  const workspaceId = useStore((state) => state.getActiveWorkspaceId());
  if (!workspaceId) return null;

  const filter = tabFilters[workspaceId][scope];
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
          <CategoryComponent key={category} category={category} />
        ))}
      </div>
    </div>
  );
};
