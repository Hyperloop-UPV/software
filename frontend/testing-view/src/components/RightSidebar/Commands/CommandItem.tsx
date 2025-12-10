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

  const handleRun = () => {
    console.log(
      "Running command:",
      command.name,
      "with params:",
      parameterValues,
    );
  };

  return (
    <div className="border">
      <div className="flex">
        <Button onClick={handleRun}>
          <Play />
        </Button>

        <span>{command.name}</span>

        {hasParameters && (
          <Button onClick={() => setIsExpanded(!isExpanded)}>
            <ChevronDown className={isExpanded ? "rotate-180" : ""} />
          </Button>
        )}
      </div>

      {hasParameters && (
        <Collapsible open={isExpanded}>
          <CollapsibleContent>
            <div>
              {command.parameters!.map((param) => (
                <div key={param.name}>
                  <label>{param.name}</label>
                  <input
                    type={param.type === "number" ? "number" : "text"}
                    value={parameterValues[param.name] || ""}
                    onChange={(e) =>
                      setParameterValues((prev) => ({
                        ...prev,
                        [param.name]: e.target.value,
                      }))
                    }
                  />
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
};
