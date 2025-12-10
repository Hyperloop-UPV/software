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
    <div>
      <div className="flex">
        <h3 className="text-foreground">
          {title} ({selectedCount} / {totalCount})
        </h3>
        <Button onClick={onFilterClick}>Filter</Button>
      </div>

      <div>
        {categories.map((category) => (
          <CategoryComponent key={category} category={category} />
        ))}
      </div>
    </div>
  );
};
