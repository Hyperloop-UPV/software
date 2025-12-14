import { useState } from "react";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
  Checkbox,
} from "@workspace/ui";
import { ChevronDown, ChevronLeft } from "@workspace/ui/icons";
import { GenericFilterItem } from "./GenericFilterItem";

interface GenericFilterCategoryItemProps {
  category: string;
  allItems: Array<{ id: string; name: string }>;
  selectedIds: string[];
  categoryState: {
    checked: boolean;
    indeterminate: boolean;
  };
  onToggleCategory: (checked: boolean) => void;
  onToggleItem: (id: string) => void;
}

export const GenericFilterCategoryItem = ({
  category,
  allItems,
  selectedIds,
  categoryState,
  onToggleCategory,
  onToggleItem,
}: GenericFilterCategoryItemProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const checkedCount = selectedIds.length;
  const totalCount = allItems.length;

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <div className="bg-card overflow-hidden rounded-lg border">
        <div className="hover:bg-accent/30 flex items-center gap-3 p-3 transition-colors">
          <Checkbox
            checked={
              categoryState.indeterminate
                ? "indeterminate"
                : categoryState.checked
            }
            onCheckedChange={(checked) => onToggleCategory(checked as boolean)}
          />

          <CollapsibleTrigger className="flex flex-1 items-center justify-between">
            <span className="text-foreground text-sm font-medium">
              {category}
              <span className="text-muted-foreground ml-2 text-xs">
                ({checkedCount}/{totalCount})
              </span>
            </span>
            {isExpanded ? (
              <ChevronDown
                className={`text-muted-foreground h-4 w-4 transition-transform duration-200`}
              />
            ) : (
              <ChevronLeft
                className={`text-muted-foreground h-4 w-4 transition-transform duration-200`}
              />
            )}
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent>
          <div className="bg-muted/20 space-y-1 border-t p-2">
            {allItems.map((item) => (
              <GenericFilterItem
                key={item.id}
                item={item}
                isChecked={selectedIds.includes(item.id)}
                onToggle={() => onToggleItem(item.id)}
              />
            ))}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};
