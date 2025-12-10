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
      <DialogContent className="min-w-1/3 w-fit">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="flex">
          <Button onClick={onClearAll}>Clear All</Button>
          <Button onClick={onSelectAll}>Select All</Button>
        </div>

        <div>
          {categories.map((category) => (
            <FilterCategoryComponent key={category} category={category} />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};
