import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui";
import { AlertTriangle } from "@workspace/ui/icons";
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
  extraCategories: readonly BoardName[];
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
  extraCategories,
  FilterCategoryComponent,
}: FilterDialogProps) => {
  console.log(extraCategories);
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-background text-foreground max-h-[85vh] w-full max-w-2xl min-w-[600px] overflow-y-auto px-10 py-8">
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

        {extraCategories.length > 0 && (
          <div className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/15 p-4 text-sm text-amber-600 dark:text-amber-400">
            <div className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="h-4 w-4" />
              Stale filters detected
            </div>
            <p className="mt-1 opacity-90">
              The following boards are in your saved filters but not in the
              current configuration:{" "}
              <span className="font-mono font-bold">
                {extraCategories.join(", ")}
              </span>
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 border-amber-500/30 hover:bg-amber-500/10"
              onClick={onClearAll}
            >
              Clear Stale Filters
            </Button>
          </div>
        )}

        <div className="space-y-1">
          {categories.map((category) => (
            <FilterCategoryComponent key={category} category={category} />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};
