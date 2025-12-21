import { useState } from "react";
import {
  Checkbox,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@workspace/ui";
import { ChevronDown, ChevronLeft } from "@workspace/ui/icons";
import { useStore } from "../../store/store";
import type { BoardName } from "../../types/BoardName";
import { GenericFilterItem } from "./Generic/GenericFilterItem";

export const FilterCategoryItem = ({ category }: { category: BoardName }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { scope } = useStore((s) => s.filterDialog);
  if (!scope) return null;
  const dialogScope = scope === "logs" ? "packets" : scope;

  const workspaceId = useStore((s) => s.getActiveWorkspaceId());
  if (!workspaceId) return null;

  const toggleCategoryFilter = useStore((s) => s.toggleCategoryFilter);
  const toggleItemFilter = useStore((s) => s.toggleItemFilter);

  //   const selectedIds = useStore((s) => {
  //     if (!workspaceId || !scope) return [];
  //     const filters = s.tabFilters[workspaceId][scope];
  //     if (!filters) return [];
  //     return filters[category];
  //   });
  //   const catalogItems = useStore((s) => s[dialogScope]);
  //   const items = catalogItems[category];
  //   const totalItems = items.length;
  //   const toggleCategory = useStore((s) => s.toggleCategoryFilter);
  //   const toggleItem = useStore((s) => s.toggleItemFilter);
  //   const isItemExpanded = useStore((s) => s.isItemExpanded);
  //   const isAllSelected = selectedIds.length === totalItems && totalItems > 0;
  //   const isIndeterminate =
  //     selectedIds.length > 0 && selectedIds.length < totalItems;
  //   if (totalItems === 0) return null;

  const catalogItems = useStore((s) => s[dialogScope]);
  const items = catalogItems[category];
  const totalItems = items.length;

  const filters = useStore((s) => s.tabFilters[workspaceId][scope]);
  const selectedIds = filters[category];

  const isAllSelected = selectedIds.length === totalItems && totalItems > 0;
  const isIndeterminate =
    selectedIds.length > 0 && selectedIds.length < totalItems;

  return (
    totalItems > 0 && (
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <div className="bg-card overflow-hidden rounded-lg border">
          <div className="hover:bg-accent/30 flex items-center gap-3 p-3 transition-colors">
            <Checkbox
              checked={
                isAllSelected || (isIndeterminate ? "indeterminate" : false)
              }
              onCheckedChange={(checked) =>
                toggleCategoryFilter(scope, category, !!checked)
              }
            />
            <CollapsibleTrigger className="flex flex-1 items-center justify-between">
              <span className="text-foreground text-sm font-medium">
                {category}
                <span className="text-muted-foreground ml-2 text-xs">
                  ({selectedIds.length}/{totalItems})
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
                <GenericFilterItem
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
