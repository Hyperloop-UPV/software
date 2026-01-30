import { logger, socketService } from "@workspace/core";
import {
  Badge,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@workspace/ui";
import { ChevronDown, Play, Send } from "@workspace/ui/icons";
import { cn } from "@workspace/ui/lib";
import { useState } from "react";
import { getDefaultParameterValues } from "../../../../../lib/commandUtils";
import { useStore } from "../../../../../store/store";
import type { CommandCatalogItem } from "../../../../../types/data/commandCatalogItem";
import { CommandParameters } from "./CommandParameters";

interface CommandItemProps {
  item: CommandCatalogItem;
}

export const CommandItem = ({ item: commandCatalogItem }: CommandItemProps) => {
  const isExpanded = useStore((s) =>
    s.isItemExpanded("commands", "packet", commandCatalogItem.id),
  );
  const toggleExpandedItem = useStore((s) => s.toggleExpandedItem);
  const keyBinding = useStore((s) =>
    s.getKeyBindingForCommand(commandCatalogItem.id),
  );

  const [parameterValues, setParameterValues] = useState<Record<string, any>>(
    () => getDefaultParameterValues(commandCatalogItem.fields),
  );

  const hasParameters = Object.keys(commandCatalogItem.fields).length > 0;
  const paramCount = Object.keys(commandCatalogItem.fields).length;

  const handleRun = (e: React.MouseEvent) => {
    e.stopPropagation();

    const payload = {
      id: commandCatalogItem.id,
      fields: Object.entries(commandCatalogItem.fields).reduce(
        (acc, [key, field]) => {
          acc[key] = {
            value:
              field.kind === "numeric"
                ? parseFloat(parameterValues[key])
                : parameterValues[key],
            isEnabled: true, // Set to true by default, could be implemented in the future, but does not really make any sense for me
            type: field.type,
          };
          return acc;
        },
        {} as Record<string, any>,
      ),
    };

    logger.testingView.log(
      "Running command:",
      commandCatalogItem.name,
      "with payload:",
      payload,
    );

    socketService.post("order/send", payload);
  };

  const handleParameterChange = (fieldId: string, value: any) => {
    setParameterValues((prev) => ({ ...prev, [fieldId]: value }));
  };

  return (
    <div className="border-b last:border-b-0">
      {hasParameters ? (
        <Collapsible
          open={isExpanded}
          onOpenChange={() =>
            toggleExpandedItem("commands", "packet", commandCatalogItem.id)
          }
        >
          <CollapsibleTrigger className="hover:bg-accent/50 group flex w-full items-center gap-2 px-3 py-2 transition-colors">
            <div
              role="button"
              onClick={handleRun}
              className="hover:bg-primary/90 hover:text-primary-foreground bg-primary/10 text-primary flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
            </div>

            <div className="flex flex-1 items-center gap-2">
              <div className="flex flex-1 items-center gap-2">
                <span className="text-foreground max-w-4/5 truncate text-left text-sm font-medium">
                  {commandCatalogItem.label}
                </span>
                <Badge variant="outline" className="h-4 px-1.5 text-xs">
                  {commandCatalogItem.id}
                </Badge>

                {keyBinding && (
                  <Badge
                    variant="default"
                    className="h-4 bg-purple-500 px-1.5 font-mono text-xs font-bold text-white"
                  >
                    {keyBinding}
                  </Badge>
                )}
              </div>
              <Badge variant="secondary" className="h-4 px-1.5 text-xs">
                {paramCount}
              </Badge>
            </div>

            <ChevronDown
              className={cn(
                "text-muted-foreground h-4 w-4 shrink-0 transition-transform duration-200",
                isExpanded && "rotate-180",
              )}
            />
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="bg-muted/30 flex flex-col items-end space-y-3.5 border-t px-5 py-3">
              <CommandParameters
                fields={commandCatalogItem.fields}
                values={parameterValues}
                onChange={handleParameterChange}
              />

              {/* Send button at bottom */}
              <button
                onClick={handleRun}
                className="hover:bg-primary bg-primary/90 text-primary-foreground flex w-fit justify-center gap-2 rounded-md px-3.5 py-2 text-xs font-medium transition-colors"
              >
                <Send className="h-3.5 w-3.5" />
                Send Command
              </button>
            </div>
          </CollapsibleContent>
        </Collapsible>
      ) : (
        <div className="hover:bg-accent/50 group flex items-center gap-2 px-3 py-2 transition-colors">
          <button
            onClick={handleRun}
            className="hover:bg-primary/90 hover:text-primary-foreground bg-primary/10 text-primary flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
          </button>

          <div className="flex flex-1 items-center gap-2">
            <span className="text-foreground max-w-1/2 truncate text-left text-sm font-medium">
              {commandCatalogItem.label}
            </span>
            <Badge variant="outline" className="h-4 px-1.5 text-xs">
              {commandCatalogItem.id}
            </Badge>
          </div>
        </div>
      )}
    </div>
  );
};
