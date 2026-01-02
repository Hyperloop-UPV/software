import { Badge, Separator } from "@workspace/ui";
import { Activity, ChevronDown } from "@workspace/ui/icons";
import { cn } from "@workspace/ui/lib";
import { useEffect, useRef, useState } from "react";
import { useStore } from "../../../../../store/store";

interface PacketHeaderProps {
  packet: any;
  isExpanded: boolean;
  onToggle: () => void;
}

export const PacketHeader = ({ packet, onToggle }: PacketHeaderProps) => {
  const isExpanded = useStore((s) => s.isItemExpanded("packets", packet.id));

  const liveData = useStore((s) => s.telemetry[packet.id]);

  const [isActive, setIsActive] = useState(false);
  const lastCountRef = useRef<number | undefined>(liveData?.count);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debug log
  // useEffect(() => {
  //   console.log("📦 PacketItem rendered:", packet.id);
  //   return () => console.log("📦 PacketItem unmounted:", packet.id);
  // }, []);

  // Track when packet updates and show active for 2 seconds
  useEffect(() => {
    const currentCount = liveData?.count;

    // Only trigger if count actually changed
    if (currentCount !== undefined && currentCount !== lastCountRef.current) {
      // Update ref first
      lastCountRef.current = currentCount;

      // Set active
      setIsActive(true);

      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Set inactive after 500ms
      timeoutRef.current = setTimeout(() => {
        setIsActive(false);
      }, 500);
    }

    // Cleanup on unmount
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [liveData?.count]);

  return (
    <div
      onClick={onToggle}
      className="hover:bg-accent/50 bg-background group flex w-full cursor-pointer items-center gap-3 border-b px-3 py-2.5 transition-all"
    >
      {/* Chevron + Activity Indicator */}
      <div className="flex items-center gap-2">
        <ChevronDown
          className={cn(
            "text-muted-foreground h-4 w-4 shrink-0 transition-transform duration-200",
            !isExpanded && "-rotate-90",
          )}
        />
        <div className="relative">
          <Activity
            className={cn(
              "h-3.5 w-3.5",
              isActive ? "text-green-500" : "text-primary",
            )}
          />
          <div
            className={cn(
              "absolute right-0 top-0 h-1.5 w-1.5 rounded-full opacity-100",
              isActive ? "bg-green-500" : "bg-primary",
            )}
          />
        </div>
      </div>

      {/* Packet Name + ID */}
      <div className="flex flex-1 items-center gap-2 overflow-hidden">
        <span className="text-foreground truncate text-sm font-semibold">
          {packet.label}
        </span>
        <Badge variant="outline" className="h-4 px-1.5 font-mono text-xs">
          {packet.id}
        </Badge>
      </div>

      {/* Live Stats */}
      {liveData && (
        <div className="flex items-center gap-2 text-[11px]">
          <div
            className={cn(
              "flex items-center gap-1 rounded px-2 py-0.5 font-mono font-semibold transition-colors",
              isActive
                ? "bg-green-500/20 text-green-600"
                : "bg-primary/10 text-primary",
            )}
          >
            <span className="text-muted-foreground">#</span>
            {liveData.count}
          </div>
          <Separator orientation="vertical" className="h-3" />
          <div className="text-muted-foreground font-mono">
            {liveData.cycleTime}ms
          </div>
        </div>
      )}
    </div>
  );
};
