import { ChevronDown, ChevronLeft } from "@workspace/ui/icons";

interface CategoryHeaderProps {
  name: string;
  count: number;
  isExpanded: boolean;
  onToggle: () => void;
}

export const CategoryHeader = ({
  name,
  count,
  isExpanded,
  onToggle,
}: CategoryHeaderProps) => (
  <div className="bg-card hover:border-primary/50 overflow-hidden rounded-lg border">
    <div
      onClick={onToggle}
      className="hover:bg-accent/50 flex w-full cursor-pointer items-center justify-between px-3 py-2.5"
    >
      <span className="text-foreground font-semibold">
        {name}
        <span className="text-muted-foreground ml-2 text-sm">({count})</span>
      </span>
      {isExpanded ? (
        <ChevronDown className="text-muted-foreground h-4 w-4" />
      ) : (
        <ChevronLeft className="text-muted-foreground h-4 w-4" />
      )}
    </div>
  </div>
);
