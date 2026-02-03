import { Badge, Checkbox } from "@workspace/ui";
import type { CatalogItem } from "../../../types/common/item";

interface FilterItemProps {
  item: CatalogItem;
  isChecked: boolean;
  onToggle: () => void;
}

export const FilterItem = ({ item, isChecked, onToggle }: FilterItemProps) => {
  return (
    <div
      onClick={onToggle}
      className="hover:bg-accent/50 flex cursor-pointer items-center gap-2 rounded p-2 transition-colors"
    >
      <Checkbox
        checked={isChecked}
        onClick={(e) => e.stopPropagation()}
        onCheckedChange={onToggle}
      />
      <div className="text-foreground flex items-center gap-2 text-sm">
        <span>{item.label}</span>
        <Badge variant="outline">{item.id}</Badge>
      </div>
    </div>
  );
};
