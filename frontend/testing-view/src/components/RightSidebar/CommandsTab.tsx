import {
  Button,
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
  Input,
  Label,
} from "@workspace/ui";
import { ChevronDown, ChevronRight, Pencil, Play } from "@workspace/ui/icons";
import { useState } from "react";
import { MOCK_COMMANDS, ECU_CATEGORIES } from "../../mocks/commands";
import type { Command } from "../../mocks/commands";

interface CommandsTabProps {
  visibleCommands: Command[];
  totalCommands: number;
  onOpenFilter: () => void;
}

export const CommandsTab = ({
  visibleCommands,
  totalCommands,
  onOpenFilter,
}: CommandsTabProps) => {
  // Track which categories are expanded
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(),
  );

  // Track which commands are expanded
  const [expandedCommands, setExpandedCommands] = useState<Set<string>>(
    new Set(),
  );

  // Track parameter values for each command
  const [parameterValues, setParameterValues] = useState<
    Record<string, Record<string, string>>
  >({});

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

  const toggleCommand = (commandId: string) => {
    setExpandedCommands((prev) => {
      const next = new Set(prev);
      if (next.has(commandId)) {
        next.delete(commandId);
      } else {
        next.add(commandId);
      }
      return next;
    });
  };

  const handleParameterChange = (
    commandId: string,
    paramName: string,
    value: string,
  ) => {
    setParameterValues((prev) => ({
      ...prev,
      [commandId]: {
        ...prev[commandId],
        [paramName]: value,
      },
    }));
  };

  const handleRunCommand = (cmd: Command) => {
    const params = parameterValues[cmd.id] || {};
    console.log("Running command:", cmd.name, "with params:", params);
    // TODO: Implement actual command execution
  };

  // Group visible commands by category
  const groupedCommands = ECU_CATEGORIES.reduce(
    (acc, category) => {
      const categoryCommands = visibleCommands.filter((cmd) =>
        MOCK_COMMANDS[category].some((c) => c.id === cmd.id),
      );
      if (categoryCommands.length > 0) {
        acc[category] = categoryCommands;
      }
      return acc;
    },
    {} as Record<string, Command[]>,
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">
          Commands{" "}
          <span className="text-muted-foreground">
            ({visibleCommands.length} / {totalCommands})
          </span>
        </h3>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 p-2"
          onClick={onOpenFilter}
        >
          <Pencil className="h-3 w-3" />
        </Button>
      </div>

      {/* Grouped Commands by ECU */}
      <div className="space-y-3">
        {Object.entries(groupedCommands).map(([category, commands]) => {
          const isCategoryExpanded = expandedCategories.has(category);

          return (
            <Collapsible
              key={category}
              open={isCategoryExpanded}
              onOpenChange={() => toggleCategory(category)}
            >
              <div className="overflow-hidden rounded-lg border">
                {/* Category Header */}
                <CollapsibleTrigger className="w-full">
                  <div className="bg-muted/30 hover:bg-muted/50 flex cursor-pointer items-center justify-between p-2">
                    <span className="text-xs font-semibold">
                      {category}
                      <span className="text-muted-foreground ml-1">
                        ({commands.length})
                      </span>
                    </span>
                    <ChevronDown
                      className={`h-3 w-3 transition-transform ${
                        isCategoryExpanded ? "rotate-180" : ""
                      }`}
                    />
                  </div>
                </CollapsibleTrigger>

                {/* Category Commands */}
                <CollapsibleContent>
                  <div className="space-y-2 p-2">
                    {commands.map((cmd) => {
                      const isCommandExpanded = expandedCommands.has(cmd.id);
                      const hasParameters =
                        cmd.parameters && cmd.parameters.length > 0;

                      return (
                        <div
                          key={cmd.id}
                          className={`overflow-hidden rounded-md border ${
                            cmd.dangerous
                              ? "border-red-500/50 bg-red-500/5"
                              : ""
                          }`}
                        >
                          {/* Command Info Block */}
                          <div className="flex items-center gap-2 p-2">
                            {/* Run button */}
                            <Button
                              variant={
                                cmd.dangerous ? "destructive" : "default"
                              }
                              size="sm"
                              className="h-8 w-8 shrink-0 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRunCommand(cmd);
                              }}
                              title={`Run ${cmd.name}`}
                            >
                              <Play className="h-3.5 w-3.5" />
                            </Button>

                            {/* Command Info */}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">
                                  {cmd.name}
                                </span>
                                {cmd.dangerous && (
                                  <span
                                    className="text-xs text-red-500"
                                    title="Dangerous command"
                                  >
                                    ⚠
                                  </span>
                                )}
                              </div>
                              <p className="text-muted-foreground mt-0.5 line-clamp-1 text-xs">
                                {cmd.description}
                              </p>
                            </div>

                            {/* Expand button if has parameters */}
                            {hasParameters && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 shrink-0 p-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleCommand(cmd.id);
                                }}
                                title="Show parameters"
                              >
                                <ChevronDown
                                  className={`h-3 w-3 transition-transform ${
                                    isCommandExpanded ? "rotate-180" : ""
                                  }`}
                                />
                              </Button>
                            )}
                          </div>

                          {/* Command Parameters with Inputs (Collapsible) */}
                          {hasParameters && isCommandExpanded && (
                            <div className="bg-muted/20 space-y-3 border-t px-3 py-3">
                              <div className="text-muted-foreground text-xs font-semibold">
                                Parameters:
                              </div>
                              {cmd.parameters!.map((param, idx) => {
                                const currentValue =
                                  parameterValues[cmd.id]?.[param.name] ||
                                  String(param.default || "");

                                return (
                                  <div key={idx} className="space-y-1.5">
                                    <Label className="flex items-center gap-1 text-xs">
                                      {param.name}
                                      {param.required && (
                                        <span className="text-red-500">*</span>
                                      )}
                                      <span className="text-muted-foreground font-normal">
                                        ({param.type})
                                      </span>
                                    </Label>
                                    {param.type === "boolean" ? (
                                      <select
                                        className="bg-background h-8 w-full rounded-md border px-2 text-xs"
                                        value={currentValue}
                                        onChange={(e) =>
                                          handleParameterChange(
                                            cmd.id,
                                            param.name,
                                            e.target.value,
                                          )
                                        }
                                      >
                                        <option value="true">true</option>
                                        <option value="false">false</option>
                                      </select>
                                    ) : (
                                      <Input
                                        type={
                                          param.type === "number"
                                            ? "number"
                                            : "text"
                                        }
                                        value={currentValue}
                                        onChange={(e) =>
                                          handleParameterChange(
                                            cmd.id,
                                            param.name,
                                            e.target.value,
                                          )
                                        }
                                        placeholder={
                                          param.default !== undefined
                                            ? `Default: ${param.default}`
                                            : `Enter ${param.name}`
                                        }
                                        className="h-8 text-xs"
                                      />
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })}

        {/* Empty state */}
        {Object.keys(groupedCommands).length === 0 && (
          <div className="text-muted-foreground py-8 text-center text-sm">
            No commands selected. Click the ✏️ to select commands.
          </div>
        )}
      </div>
    </div>
  );
};
