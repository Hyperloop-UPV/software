import { type ComponentType } from "react";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@workspace/ui";
import { ChevronDown, ChevronLeft } from "@workspace/ui/icons";
import type { BoardName } from "../../../types/BoardName";
import type { Item } from "../../../types/Item";
import useFilterableData from "../../../hooks/useFilterableData";
import type { StoreApi } from "zustand";
import type { UseBoundStore } from "zustand";
import type { CatalogStore } from "../../../store/useCommandsCatalogStore";
import type { FilterableStoreProps } from "../../../store/createFilterableStore";

interface GenericCategoryItemProps {
  category: BoardName;
  useCatalogStore: UseBoundStore<StoreApi<CatalogStore>>;
  useFilterStore: UseBoundStore<StoreApi<FilterableStoreProps>>;
  ItemComponent: ComponentType<{ item: Item }>;
}

export const GenericCategoryItem = ({
  category,
  useCatalogStore,
  useFilterStore,
  ItemComponent,
}: GenericCategoryItemProps) => {
  const { filteredItems } = useFilterableData(useCatalogStore, useFilterStore);
  const { isItemExpanded, toggleExpandedItem } = useFilterStore();

  const isExpanded = isItemExpanded(category);
  const items = filteredItems[category];

  return (
    <>
      {items.length > 0 && (
        <Collapsible
          open={isExpanded}
          onOpenChange={() => toggleExpandedItem(category)}
        >
          <div className="bg-card hover:border-primary/50 overflow-hidden rounded-lg border transition-colors">
            <CollapsibleTrigger className="hover:bg-accent/50 flex w-full items-center justify-between px-3 py-2.5 transition-colors">
              <span className="text-foreground font-semibold">
                {category}
                <span className="text-muted-foreground ml-2 text-sm">
                  ({items.length})
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
                {items.map((item, index) => (
                  <ItemComponent key={index} item={item} />
                ))}
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      )}
    </>
  );
};
