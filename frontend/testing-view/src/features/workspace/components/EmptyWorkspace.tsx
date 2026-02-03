import { Button } from "@workspace/ui";
import { LayoutGrid, Plus } from "@workspace/ui/icons";

interface EmptyWorkspaceProps {
  onAddChart: () => void;
}

export const EmptyWorkspace = ({ onAddChart }: EmptyWorkspaceProps) => {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center space-y-5 text-center">
      {/* Visual cue */}
      <div className="bg-muted/30 ring-border flex h-24 w-24 items-center justify-center rounded-3xl shadow-sm ring-1">
        <LayoutGrid className="text-muted-foreground/30 h-12 w-12" />
      </div>

      {/* Typography */}
      <div className="space-y-2 px-6">
        <h3 className="text-foreground text-2xl font-semibold tracking-tight">
          Empty Workspace
        </h3>
        <p className="text-muted-foreground max-w-[320px] text-sm leading-relaxed">
          Visualize real-time telemetry by adding your first chart or selecting
          variables from the sidebar.
        </p>
      </div>

      {/* Add chart button */}
      <Button
        onClick={onAddChart}
        variant="secondary"
        className="ring-border/50 hover:ring-primary/30 gap-2 px-6 shadow-sm ring-1 transition-all"
      >
        <Plus className="h-4 w-4" />
        Add your first chart
      </Button>
    </div>
  );
};
