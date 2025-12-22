import { type ComponentType } from "react";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@workspace/ui";
import { ChevronDown, ChevronLeft } from "@workspace/ui/icons";
import type { BoardName } from "../../../types/BoardName";
import type { Item } from "../../../types/Item";
import { useStore } from "../../../store/store";
import type { SidebarTab } from "../../../types/SidebarTab";
import { useShallow } from "zustand/shallow";

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

  const isExpanded = useStore((state) => state.isItemExpanded(scope, category));
  const toggleExpandedItem = useStore((state) => state.toggleExpandedItem);

  return (
    filteredItems?.length > 0 && (
      <Collapsible
        open={isExpanded}
        onOpenChange={() => toggleExpandedItem(scope, category)}
      >
        <div className="bg-card hover:border-primary/50 overflow-hidden rounded-lg border transition-colors">
          <CollapsibleTrigger className="hover:bg-accent/50 flex w-full items-center justify-between px-3 py-2.5 transition-colors">
            <span className="text-foreground font-semibold">
              {category}
              <span className="text-muted-foreground ml-2 text-sm">
                ({filteredItems?.length})
              </span>
            </span>
            {isExpanded ? (
              <ChevronDown className="text-muted-foreground h-4 w-4 transition-transform duration-200" />
            ) : (
              <ChevronLeft className="text-muted-foreground h-4 w-4 transition-transform duration-200" />
            )}
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="bg-muted/30 border-t">
              {filteredItems?.map((item) => (
                <ItemComponent key={item.id} item={item} />
              ))}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    )
  );
};
