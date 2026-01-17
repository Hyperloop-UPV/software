import { logger } from "@workspace/core";
import {
  Badge,
  Checkbox,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui";
import { ChevronDown, Play, Send } from "@workspace/ui/icons";
import { cn } from "@workspace/ui/lib";
import { useState } from "react";
import { useStore } from "../../../../../store/store";
import type {
  CommandCatalogItem,
  CommandParameter,
  EnumCommandParameter,
  NumericCommandParameter,
} from "../../../../../types/data/commandCatalogItem";

interface CommandItemProps {
  item: CommandCatalogItem;
}

export const CommandItem = ({ item: commandCatalogItem }: CommandItemProps) => {
  const isExpanded = useStore((s) =>
    s.isItemExpanded("commands", "packet", commandCatalogItem.id),
  );
  const toggleExpandedItem = useStore((s) => s.toggleExpandedItem);

  const [parameterValues, setParameterValues] = useState<Record<string, any>>(
    () => {
      const defaults: Record<string, any> = {};
      Object.entries(commandCatalogItem.fields).forEach(([key, field]) => {
        if (field.kind === "numeric") {
          defaults[key] = "";
        } else if (field.kind === "enum") {
          defaults[key] = (field as EnumCommandParameter).options[0] || "";
        } else if (field.kind === "boolean") {
          defaults[key] = false;
        }
      });
      return defaults;
    },
  );

  const hasParameters = Object.keys(commandCatalogItem.fields).length > 0;
  const paramCount = Object.keys(commandCatalogItem.fields).length;

  const handleRun = (e: React.MouseEvent) => {
    e.stopPropagation();
    logger.testingView.log(
      "Running command:",
      commandCatalogItem.name,
      "with params:",
      parameterValues,
    );
    // TODO: Send command to backend
  };

  const handleParameterChange = (fieldId: string, value: any) => {
    setParameterValues((prev) => ({ ...prev, [fieldId]: value }));
  };

  const renderParameterInput = (field: CommandParameter) => {
    if (field.kind === "numeric") {
      const numField = field as NumericCommandParameter;
      const min = numField.warningRange[0];
      const max = numField.warningRange[1];
      const placeholder =
        min !== null && max !== null ? `${min} - ${max}` : field.type;

      return (
        <div key={field.id} className="w-full space-y-1.5">
          <Label
            htmlFor={field.id}
            className="text-muted-foreground text-xs font-medium"
          >
            {field.name}
          </Label>
          <Input
            id={field.id}
            type="number"
            placeholder={placeholder}
            value={parameterValues[field.id] || ""}
            onChange={(e) => handleParameterChange(field.id, e.target.value)}
            className="h-8 text-xs"
          />
          {min !== null && max !== null && (
            <p className="text-muted-foreground text-[10px]">
              Range: {min} to {max}
            </p>
          )}
        </div>
      );
    }

    if (field.kind === "enum") {
      const enumField = field as EnumCommandParameter;
      return (
        <div key={field.id} className="w-full space-y-1.5">
          <Label
            htmlFor={field.id}
            className="text-muted-foreground text-xs font-medium"
          >
            {field.name}
          </Label>
          <Select
            value={parameterValues[field.id] || ""}
            onValueChange={(value) => handleParameterChange(field.id, value)}
          >
            <SelectTrigger className="text-xs">
              <SelectValue placeholder="Select option" />
            </SelectTrigger>
            <SelectContent>
              {enumField.options.map((option) => (
                <SelectItem
                  key={option}
                  value={option}
                  className="py-1 text-xs"
                >
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    if (field.kind === "boolean") {
      return (
        <div
          key={field.id}
          className="flex w-full items-center justify-between rounded-md border p-2"
        >
          <Label
            htmlFor={field.id}
            className="text-foreground cursor-pointer text-xs font-medium"
          >
            {field.name}
          </Label>
          <Checkbox
            id={field.id}
            checked={parameterValues[field.id] || false}
            onCheckedChange={(checked) =>
              handleParameterChange(field.id, checked)
            }
          />
        </div>
      );
    }

    return null;
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
                <span className="text-foreground max-w-1/2 truncate text-left text-sm font-medium">
                  {commandCatalogItem.label}
                </span>
                <Badge variant="outline" className="h-4 px-1.5 text-xs">
                  {commandCatalogItem.id}
                </Badge>
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
            <div className="bg-muted/30 flex flex-col items-end space-y-3 border-t px-5 py-3">
              {Object.values(commandCatalogItem.fields).map(
                (field: CommandParameter) => renderParameterInput(field),
              )}

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
