import { useState } from "react";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
  Checkbox,
} from "@workspace/ui";
import { ChevronRight } from "@workspace/ui/icons";
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
      <div className="border">
        <div className="flex">
          <Checkbox
            checked={
              categoryState.indeterminate
                ? "indeterminate"
                : categoryState.checked
            }
            onCheckedChange={(checked) => onToggleCategory(checked as boolean)}
          />

          <CollapsibleTrigger className="flex">
            <span className="text-foreground">
              {category} ({checkedCount}/{totalCount})
            </span>
            <ChevronRight
              className={`text-foreground ${isExpanded ? "rotate-90" : ""}`}
            />
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent>
          <div>
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
