import { type ComponentType } from "react";
import type { CatalogItem } from "../../../../types/common/item";
import type { BoardName } from "../../../../types/data/board";
import type { SidebarTab } from "../../../../types/workspace/sidebar";
import { CategoryItem } from "./CategoryItem";

interface StandardListProps {
  scope: SidebarTab;
  categories: readonly BoardName[];
  ItemComponent: ComponentType<{ item: CatalogItem }>;
}

export const StandardList = ({
  scope,
  categories,
  ItemComponent,
}: StandardListProps) => (
  <div className="custom-scrollbar h-full space-y-1 overflow-y-auto pr-2">
    {categories.map((category) => (
      <CategoryItem
        key={category}
        category={category}
        scope={scope}
        ItemComponent={ItemComponent}
      />
    ))}
  </div>
);
