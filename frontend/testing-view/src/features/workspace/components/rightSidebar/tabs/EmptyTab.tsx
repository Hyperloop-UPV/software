// EmptyTabState.tsx
import { Button } from "@workspace/ui";
import { Filter, ListFilterPlus } from "@workspace/ui/icons";

interface EmptyTabProps {
  title: string;
  onOpenFilter: () => void;
}

export const EmptyTab = ({ title, onOpenFilter }: EmptyTabProps) => {
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
      <div className="flex flex-col items-center gap-4">
        <div className="bg-muted/50 rounded-full p-4">
          <Filter className="text-muted-foreground h-8 w-8" />
        </div>
        <div className="space-y-2">
          <p className="text-foreground text-base font-medium">
            No {title.toLowerCase()} selected
          </p>
          <p className="text-muted-foreground text-sm">
            Use filters to select which {title.toLowerCase()} to display
          </p>
        </div>
        <Button onClick={onOpenFilter} variant="default" className="mt-2">
          <ListFilterPlus className="mr-2 h-4 w-4" />
          Open Filters
        </Button>
      </div>
    </div>
  );
};
