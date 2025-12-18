import { Checkbox } from "@workspace/ui";
import type { Item } from "../../../types/Item";

interface GenericFilterItemProps {
  item: Item;
  isChecked: boolean;
  onToggle: () => void;
}

export const GenericFilterItem = ({
  item,
  isChecked,
  onToggle,
}: GenericFilterItemProps) => {
  return (
    <div className="hover:bg-accent/50 flex cursor-pointer items-center gap-2 rounded p-2 transition-colors">
      <Checkbox checked={isChecked} onCheckedChange={onToggle} />
      <span className="text-foreground text-sm">{item.label}</span>
    </div>
  );
};
