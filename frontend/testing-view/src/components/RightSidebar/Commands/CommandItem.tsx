import { useState } from "react";
import {
  Button,
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@workspace/ui";
import { ChevronDown, Play } from "@workspace/ui/icons";
import type { Command } from "../../../types/Command";

interface CommandItemProps {
  item: Command;
}

export const CommandItem = ({ item: command }: CommandItemProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [parameterValues, setParameterValues] = useState<
    Record<string, string>
  >({});

  const hasParameters = command.parameters && command.parameters.length > 0;

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
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger className="hover:bg-accent/30 flex w-full items-center gap-1.5 px-2 py-1 transition-colors">
            <Button
              onClick={handleRun}
              size="icon"
              variant="ghost"
              className="h-6 w-6 shrink-0"
            >
              <Play className="text-foreground h-3 w-3" />
            </Button>

            <span className="text-foreground flex-1 truncate text-left text-xs">
              {command.name}
            </span>

            <ChevronDown
              className={`text-muted-foreground h-3 w-3 shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
            />
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="bg-muted/20 space-y-1.5 px-2 pb-1.5">
              {command.parameters!.map((param) => (
                <div key={param.name} className="space-y-0.5">
                  <label className="text-muted-foreground flex items-center gap-1 text-[10px] font-medium">
                    <span>
                      {param.name}
                      {param.required && (
                        <span className="text-destructive">*</span>
                      )}
                    </span>
                    <span className="bg-primary/10 text-primary rounded px-1 py-0.5 text-[9px]">
                      {param.type}
                    </span>
                  </label>
                  <input
                    type={param.type === "number" ? "number" : "text"}
                    value={parameterValues[param.name] || ""}
                    placeholder={param.default?.toString() || ""}
                    onChange={(e) =>
                      setParameterValues((prev) => ({
                        ...prev,
                        [param.name]: e.target.value,
                      }))
                    }
                    className="bg-background text-foreground focus:ring-primary/50 w-full rounded border px-2 py-1 text-xs focus:outline-none focus:ring-1"
                  />
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      ) : (
        <div className="hover:bg-accent/30 flex items-center gap-1.5 px-2 py-1 transition-colors">
          <Button
            onClick={handleRun}
            size="icon"
            variant="ghost"
            className="h-6 w-6 shrink-0"
          >
            <Play className="text-foreground h-3 w-3" />
          </Button>

          <span className="text-foreground flex-1 truncate text-xs">
            {command.name}
          </span>
        </div>
      )}
    </div>
  );
};
