import { type ComponentType } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Button,
} from "@workspace/ui";

interface GenericFilterDialogProps {
  title: string;
  description?: string;
  isOpen: boolean;
  onClose: (open: boolean) => void;
  onClearAll: () => void;
  onSelectAll: () => void;
  categories: readonly string[];
  FilterCategoryComponent: ComponentType<{ category: string }>;
}

export const GenericFilterDialog = ({
  title,
  description,
  isOpen,
  onClose,
  onClearAll,
  onSelectAll,
  categories,
  FilterCategoryComponent,
}: GenericFilterDialogProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="min-w-2/5 max-h-full w-fit overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
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
