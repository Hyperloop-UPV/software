import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui";
import { type ComponentType } from "react";
import type { BoardName } from "../../../types/data/board";

interface FilterDialogProps {
  title: string;
  description?: string;
  isOpen: boolean;
  onClose: (open: boolean) => void;
  onClearAll: () => void;
  onSelectAll: () => void;
  categories: readonly BoardName[];
  FilterCategoryComponent: ComponentType<{ category: BoardName }>;
}

export const FilterDialog = ({
  title,
  description,
  isOpen,
  onClose,
  onClearAll,
  onSelectAll,
  categories,
  FilterCategoryComponent,
}: FilterDialogProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-background text-foreground max-h-[85vh] w-full min-w-[600px] max-w-2xl overflow-y-auto px-10 py-8">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold">{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="flex justify-end gap-2">
          <Button size="sm" onClick={onClearAll}>
            Clear All
          </Button>
          <Button size="sm" onClick={onSelectAll}>
            Select All
          </Button>
        </div>

        <div className="space-y-1">
          {categories.map((category) => (
            <FilterCategoryComponent key={category} category={category} />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};
