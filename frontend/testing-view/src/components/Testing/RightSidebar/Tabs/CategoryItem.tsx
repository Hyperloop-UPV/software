import { Collapsible, CollapsibleContent } from "@workspace/ui";
import { type ComponentType } from "react";
import { useShallow } from "zustand/shallow";
import { useStore } from "../../../../store/store";
import type { Item } from "../../../../types/common/item";
import type { BoardName } from "../../../../types/data/board";
import type { SidebarTab } from "../../../../types/workspace/sidebar";
import { CategoryHeader } from "./CategoryHeader";

interface CategoryItemProps {
  category: BoardName;
  scope: SidebarTab;
  ItemComponent: ComponentType<{ item: Item }>;
}

export const CategoryItem = ({
  category,
  scope,
  ItemComponent,
}: CategoryItemProps) => {
  const filteredItems = useStore(
    useShallow((state) => state.getFilteredItemsByCategory(scope, category)),
  );

  const isExpanded = useStore((state) =>
    state.isItemExpanded(scope, "board", category),
  );
  const toggleExpandedItem = useStore((state) => state.toggleExpandedItem);

  return (
    filteredItems.length > 0 && (
      <Collapsible open={isExpanded}>
        <CategoryHeader
          name={category}
          count={filteredItems.length}
          isExpanded={isExpanded}
          onToggle={() => toggleExpandedItem(scope, "board", category)}
        />
        <CollapsibleContent>
          <div className="bg-muted/30 border-t">
            {filteredItems.map((item) => (
              <ItemComponent item={item} />
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    )
  );
};
