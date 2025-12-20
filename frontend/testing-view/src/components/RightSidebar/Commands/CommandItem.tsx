import { useState } from "react";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@workspace/ui";
import { ChevronDown, Play } from "@workspace/ui/icons";
import type {
  Command,
  CommandParameter,
  CommandParameters,
} from "../../../types/Command";
import { useCommandsFilterStore } from "../../../store/useCommandsFilterStore";
import { cn } from "@workspace/ui/lib";

interface CommandItemProps {
  item: Command;
}

export const CommandItem = ({ item: command }: CommandItemProps) => {
  const { isItemExpanded, toggleExpandedItem } = useCommandsFilterStore();

  const [parameterValues, setParameterValues] = useState<
    Record<string, string>
  >({});

  const hasParameters = Object.keys(command.fields).length > 0;
  const isExpanded = isItemExpanded(command.id);
  const handleToggleExpanded = () => toggleExpandedItem(command.id);

  const handleRun = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering collapse
    console.log(
      "Running command:",
      command.name,
      "with params:",
      parameterValues,
    );
  };

  return (
    <div className="border-b last:border-b-0">
      {hasParameters ? (
        <Collapsible open={isExpanded} onOpenChange={handleToggleExpanded}>
          <CollapsibleTrigger className="hover:bg-accent/30 flex w-full items-center gap-1.5 px-2.5 py-1.5 transition-colors">
            <div
              onClick={handleRun}
              className="text-foreground flex h-6 w-6 shrink-0 items-center justify-center"
            >
              <Play className="text-foreground h-4 w-4" />
            </div>

            <span className="text-foreground flex-1 truncate text-left text-sm">
              {command.label}
            </span>

            <ChevronDown
              className={cn(
                "text-muted-foreground h-3 w-3 shrink-0 transition-transform duration-200",
                isExpanded && "rotate-180",
              )}
            />
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="bg-muted/20 space-y-1.5 px-2 pb-1.5">
              {Object.values(command.fields).map((field: CommandParameter) => (
                <div key={field.id}>{field.name}</div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      ) : (
        <div className="hover:bg-accent/30 flex items-center gap-1.5 px-2.5 py-1.5 transition-colors">
          <div
            onClick={handleRun}
            className="text-foreground flex h-6 w-6 shrink-0 items-center justify-center"
          >
            <Play className="text-foreground h-4 w-4" />
          </div>

          <span className="text-foreground flex-1 truncate text-sm">
            {command.label}
          </span>
        </div>
      )}
    </div>
  );
};
