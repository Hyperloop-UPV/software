import { useStore } from "../../store/store";
import { cn } from "@workspace/ui/lib";
import type { AppMode } from "../../store/slices/appSlice";

const modeConfig: Record<AppMode, { label: string; className: string }> = {
  loading: {
    label: "Loading",
    className: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  },
  active: {
    label: "Active",
    className: "bg-green-500/15 text-green-400 border-green-500/30",
  },
  mock: {
    label: "Mock",
    className: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  },
  error: {
    label: "Error",
    className: "bg-red-500/15 text-red-400 border-red-500/30",
  },
};

export const ModeBadge = () => {
  const appMode = useStore((s) => s.appMode);
  const config = modeConfig[appMode];

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        config.className,
      )}
    >
      {appMode === "loading" && (
        <span className="mr-1.5 h-2 w-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {config.label}
    </div>
  );
};
