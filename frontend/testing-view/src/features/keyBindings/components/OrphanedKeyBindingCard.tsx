import { Badge, Button } from "@workspace/ui";
import { AlertTriangle, X } from "@workspace/ui/icons";
import { useStore } from "../../../store/store";
import type { KeyBinding } from "../types/keyBinding";

interface OrphanedKeyBindingCardProps {
  binding: KeyBinding;
}

export const OrphanedKeyBindingCard = ({
  binding,
}: OrphanedKeyBindingCardProps) => {
  const removeKeyBinding = useStore((s) => s.removeKeyBinding);

  return (
    <div className="bg-destructive/10 border-destructive/50 flex items-center gap-3 rounded-lg border p-3">
      <Badge
        variant="outline"
        className="border-destructive/50 text-destructive shrink-0 font-mono text-sm font-bold"
      >
        {binding.key}
      </Badge>

      <div className="flex flex-1 items-center gap-2">
        <AlertTriangle className="text-destructive h-4 w-4 shrink-0" />
        <div className="flex-1">
          <p className="text-foreground text-sm font-medium">
            Command Not Found
          </p>
          <p className="text-muted-foreground text-xs">
            Command ID: {binding.commandId} • Not found in catalog
          </p>
        </div>
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => removeKeyBinding(binding.id)}
        className="hover:bg-destructive/20 hover:text-destructive h-8 w-8 shrink-0 p-0"
        title="Remove orphaned binding"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
};
