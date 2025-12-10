import { useState, type ComponentType } from "react";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@workspace/ui";
import { ChevronRight } from "@workspace/ui/icons";

interface GenericCategoryItemProps<T> {
  category: string;
  items: T[];
  ItemComponent: ComponentType<{ item: T }>;
}

export const GenericCategoryItem = <T,>({
  category,
  items,
  ItemComponent,
}: GenericCategoryItemProps<T>) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <>
      {items.length > 0 && (
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <div className="border">
            <CollapsibleTrigger className="flex">
              <span className="text-foreground">
                {category} ({items.length})
              </span>
              <ChevronRight
                className={`text-foreground ${isExpanded ? "rotate-90" : ""}`}
              />
            </CollapsibleTrigger>

            <CollapsibleContent>
              <div>
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
