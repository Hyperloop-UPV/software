import { type ComponentType } from "react";
import type { CatalogItem } from "../../../../../types/common/item";
import type { BoardName } from "../../../../../types/data/board";
import { CategoryItem } from "./CategoryItem";
import type { SidebarTab } from "../../../types/sidebar";

interface StandardListProps {
  scope: SidebarTab;
  categories: readonly BoardName[];
  ItemComponent: ComponentType<{ item: CatalogItem }>;
}

/**
 * Standard tree renderer for smaller catalogs. Right now used for commands tab.\
 * Based on categories (board names) and item component recieved as prop.
 *
 * It's counterpart is VirtualizedList, which is used for Telemetry data and implements virtualization.
 */
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
