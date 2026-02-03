import { Badge, Button } from "@workspace/ui";
import { ChevronDown, X } from "@workspace/ui/icons";
import { cn } from "@workspace/ui/lib";
import { useState } from "react";
import { useStore } from "../../../store/store";
import type { KeyBinding } from "../../../types/workspace/keyBinding";

interface KeyBindingCardProps {
  binding: KeyBinding;
  commandLabel: string;
  commandId: number;
  boardName: string;
}

export const KeyBindingCard = ({
  binding,
  commandLabel,
  commandId,
  boardName,
}: KeyBindingCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const removeKeyBinding = useStore((s) => s.removeKeyBinding);

  const hasParameters = Object.keys(binding.parameters || {}).length > 0;

  return (
    <div className="rounded-lg border">
      {/* Main Card */}
      <div className="bg-muted/30 flex items-center gap-3 p-3">
        <Badge
          variant="default"
          className="bg-primary text-primary-foreground shrink-0 font-mono text-sm font-bold"
        >
          {binding.key}
        </Badge>

        <div className="flex-1">
          <p className="text-foreground text-sm font-medium">{commandLabel}</p>
          <p className="text-muted-foreground text-xs">
            ID: {commandId} • {boardName}
            {hasParameters &&
              ` • ${Object.keys(binding.parameters || {}).length} parameter(s)`}
          </p>
        </div>

        {/* Expand button - only show if has parameters */}
        {hasParameters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-8 w-8 shrink-0 p-0"
          >
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform",
                isExpanded && "rotate-180",
              )}
            />
          </Button>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={() => removeKeyBinding(binding.id)}
          className="hover:bg-destructive/10 hover:text-destructive h-8 w-8 shrink-0 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Parameters Section - Expandable */}
      {hasParameters && isExpanded && (
        <div className="border-t p-3">
          <p className="text-muted-foreground mb-2 text-xs font-medium">
            Parameters:
          </p>
          <div className="space-y-1">
            {Object.entries(binding.parameters || {}).map(([key, value]) => (
              <div
                key={key}
                className="bg-muted/50 flex justify-between rounded px-2 py-1 text-xs"
              >
                <span className="text-muted-foreground">{key}:</span>
                <span className="font-mono font-medium">
                  {typeof value === "boolean"
                    ? value
                      ? "true"
                      : "false"
                    : String(value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
