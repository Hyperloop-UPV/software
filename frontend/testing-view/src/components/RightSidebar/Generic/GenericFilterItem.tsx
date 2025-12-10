import { Checkbox } from "@workspace/ui";

interface GenericFilterItemProps {
  item: {
    id: string;
    name: string;
  };
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
      <span className="text-foreground text-sm">{item.name}</span>
    </div>
  );
};
