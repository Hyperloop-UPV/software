import { Circle } from "@workspace/ui/icons";
import { cn } from "@workspace/ui/lib/utils";

export function StatusDot({ state }: { state: string }) {
  const color = state === "nominal" ? "text-green-600" : "text-slate-400";
  return <Circle className={cn("size-3 fill-current", color)} />;
}
