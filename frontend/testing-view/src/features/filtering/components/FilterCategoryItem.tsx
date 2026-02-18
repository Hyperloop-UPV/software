import {
  Checkbox,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@workspace/ui";
import { ChevronDown, ChevronLeft } from "@workspace/ui/icons";
import { useState } from "react";
import { useShallow } from "zustand/shallow";
import { useStore } from "../../../store/store";
import type { BoardName } from "../../../types/data/board";
import { FilterItem } from "./FilterItem";

interface FilterCategoryItemProps {
  category: BoardName;
}

export const FilterCategoryItem = ({ category }: FilterCategoryItemProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { scope } = useStore((s) => s.filterDialog);
  if (!scope) return null;
  const toggleCategoryFilter = useStore((s) => s.toggleCategoryFilter);
  const toggleItemFilter = useStore((s) => s.toggleItemFilter);

  const items = useStore((s) => s.getCatalog(scope)[category]);
  const totalItems = items.length;

  const selectedIds = useStore(
    useShallow((s) => s.getFilteredItemsIdsByCategory(scope, category)),
  );
  const selectedCount = useStore((s) =>
    s.getFilteredCountByCategory(scope, category),
  );

  const selectionState = useStore((s) => s.getSelectionState(scope, category));

  return (
    totalItems > 0 && (
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <div className="bg-card overflow-hidden rounded-lg border">
          <div className="hover:bg-accent/30 flex items-center gap-3 p-3 transition-colors">
            <Checkbox
              checked={selectionState}
              onCheckedChange={(checked) =>
                toggleCategoryFilter(scope, category, !!checked)
              }
            />
            <CollapsibleTrigger className="flex flex-1 items-center justify-between">
              <span className="text-foreground text-sm font-medium">
                {category}
                <span className="text-muted-foreground ml-2 text-xs">
                  ({selectedCount}/{totalItems})
                </span>
              </span>
              {isExpanded ? (
                <ChevronDown className="text-muted-foreground h-4 w-4 transition-transform duration-200" />
              ) : (
                <ChevronLeft className="text-muted-foreground h-4 w-4 transition-transform duration-200" />
              )}
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent>
            <div className="space-y-1 p-2">
              {items.map((item) => (
                <FilterItem
                  key={item.id}
                  item={item}
                  isChecked={selectedIds.includes(item.id)}
                  onToggle={() => toggleItemFilter(scope, category, item.id)}
                />
              ))}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    )
  );
};
