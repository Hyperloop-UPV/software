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
    <div className="flex">
      <Checkbox checked={isChecked} onCheckedChange={onToggle} />
      <span className="text-foreground">{item.name}</span>
    </div>
  );
};
