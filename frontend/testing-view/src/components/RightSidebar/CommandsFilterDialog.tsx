import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Checkbox,
  Button,
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@workspace/ui";
import { MOCK_COMMANDS } from "../../mocks/commands";
import { BOARD_NAMES } from "../../mocks/commands";
import type { Command } from "../../types/Command";
import { ChevronRight } from "@workspace/ui/icons";
import { useState, useEffect, useRef } from "react";

interface CommandsFilterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  visibleCommandIds: string[];
  onToggleCommand: (commandId: string) => void;
  onClearAll: () => void;
  onSelectAll: () => void;
}

export const CommandsFilterDialog = ({
  open,
  onOpenChange,
  visibleCommandIds,
  onToggleCommand,
  onClearAll,
  onSelectAll,
}: CommandsFilterDialogProps) => {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(),
  );

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const toggleCategoryCommands = (category: string, checked: boolean) => {
    const categoryCommands =
      MOCK_COMMANDS[category as keyof typeof MOCK_COMMANDS];
    categoryCommands.forEach((cmd) => {
      if (checked && !visibleCommandIds.includes(cmd.id)) {
        onToggleCommand(cmd.id);
      } else if (!checked && visibleCommandIds.includes(cmd.id)) {
        onToggleCommand(cmd.id);
      }
    });
  };

  const getCategoryState = (category: string) => {
    const categoryCommands =
      MOCK_COMMANDS[category as keyof typeof MOCK_COMMANDS];
    const checkedCount = categoryCommands.filter((cmd) =>
      visibleCommandIds.includes(cmd.id),
    ).length;

    if (checkedCount === 0) {
      return { checked: false, indeterminate: false };
    } else if (checkedCount === categoryCommands.length) {
      return { checked: true, indeterminate: false };
    } else {
      return { checked: false, indeterminate: true };
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Filter Commands</DialogTitle>
          <DialogDescription>
            Select which commands to display by ECU category
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-2">
          {BOARD_NAMES.map((category) => {
            const commands = MOCK_COMMANDS[category];
            const isExpanded = expandedCategories.has(category);
            const { checked, indeterminate } = getCategoryState(category);

            return (
              <Collapsible
                key={category}
                open={isExpanded}
                onOpenChange={() => toggleCategory(category)}
              >
                <div className="rounded-lg border">
                  {/* Category Header */}
                  <div className="bg-muted/50 flex items-center space-x-2 p-3">
                    <CategoryCheckbox
                      checked={checked}
                      indeterminate={indeterminate}
                      onCheckedChange={(checked) =>
                        toggleCategoryCommands(category, checked as boolean)
                      }
                    />
                    <CollapsibleTrigger className="flex flex-1 cursor-pointer items-center justify-between hover:opacity-70">
                      <span className="text-sm font-semibold">
                        {category} ({commands.length})
                      </span>
                      <ChevronRight
                        className={`h-4 w-4 transition-transform ${
                          isExpanded ? "rotate-180" : ""
                        }`}
                      />
                    </CollapsibleTrigger>
                  </div>

                  {/* Category Commands */}
                  <CollapsibleContent>
                    <div className="space-y-1 border-t p-2">
                      {commands.map((cmd) => (
                        <div
                          key={cmd.id}
                          className="hover:bg-accent flex items-center space-x-2 rounded p-2"
                        >
                          <Checkbox
                            checked={visibleCommandIds.includes(cmd.id)}
                            onCheckedChange={() => onToggleCommand(cmd.id)}
                          />
                          <label className="flex-1 cursor-pointer text-sm">
                            <div className="flex items-center gap-2 font-medium">
                              {cmd.name}
                              {cmd.dangerous && (
                                <span className="text-xs font-semibold text-red-500">
                                  ⚠
                                </span>
                              )}
                            </div>
                            <div className="text-muted-foreground text-xs">
                              {cmd.description}
                            </div>
                          </label>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            );
          })}
        </div>

        <div className="flex justify-end gap-2 border-t pt-4">
          <Button variant="outline" size="sm" onClick={onClearAll}>
            Clear All
          </Button>
          <Button variant="outline" size="sm" onClick={onSelectAll}>
            Select All
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

interface CategoryCheckboxProps {
  checked: boolean;
  indeterminate: boolean;
  onCheckedChange: (checked: boolean) => void;
}

const CategoryCheckbox = ({
  checked,
  indeterminate,
  onCheckedChange,
}: CategoryCheckboxProps) => {
  const checkboxState = indeterminate ? "indeterminate" : checked;

  return (
    <Checkbox
      checked={checkboxState as any}
      onCheckedChange={onCheckedChange}
      onClick={(e) => e.stopPropagation()}
    />
  );
};
