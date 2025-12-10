import { type ComponentType } from "react";
import { Button } from "@workspace/ui";

interface GenericTabProps<TCategory extends string> {
  title: string;
  selectedCount: number;
  totalCount: number;
  onFilterClick: () => void;
  categories: readonly TCategory[];
  CategoryComponent: ComponentType<{ category: TCategory }>;
}

export const GenericTab = <TCategory extends string>({
  title,
  selectedCount,
  totalCount,
  onFilterClick,
  categories,
  CategoryComponent,
}: GenericTabProps<TCategory>) => {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 border-b pb-3">
        <h3 className="text-foreground text-lg font-semibold">
          {title}
          <span className="text-muted-foreground ml-2 text-sm font-normal">
            {selectedCount} / {totalCount}
          </span>
        </h3>
        <Button onClick={onFilterClick} size="sm" variant="outline">
          Filter
        </Button>
      </div>

      <div className="space-y-1">
        {categories.map((category) => (
          <CategoryComponent key={category} category={category} />
        ))}
      </div>
    </div>
  );
};
