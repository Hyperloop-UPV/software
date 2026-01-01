import {
  Badge,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Separator,
} from "@workspace/ui";
import { Activity, ChevronDown } from "@workspace/ui/icons";
import { cn } from "@workspace/ui/lib";
import { memo, useEffect, useRef, useState } from "react";
import { useStore } from "../../../../../store/store";
import type { Packet } from "../../../../../types/data/packet";
import { VariableItem } from "./VariableItem";

interface PacketItemProps {
  item: Packet;
}

export const PacketItem = memo(
  ({ item: packet }: PacketItemProps) => {
    const isExpanded = useStore((s) => s.isItemExpanded("packets", packet.id));
    const toggleExpandedItem = useStore((s) => s.toggleExpandedItem);

    const liveData = useStore((s) => s.telemetry[packet.id]);

    const [isActive, setIsActive] = useState(false);
    const lastCountRef = useRef<number | undefined>(liveData?.count); // Initialize with current count
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

        // Set inactive after 2 seconds
        timeoutRef.current = setTimeout(() => {
          setIsActive(false);
        }, 2000);
      }

      // Cleanup on unmount
      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    }, [liveData?.count]);

    return (
      <Collapsible
        open={isExpanded}
        onOpenChange={() => toggleExpandedItem("packets", packet.id)}
      >
        <div className="border-b last:border-b-0">
          <CollapsibleTrigger className="hover:bg-accent/50 group flex w-full items-center gap-3 px-3 py-2.5 transition-all">
            {/* Chevron + Activity Indicator */}
            <div className="flex items-center gap-2">
              <ChevronDown
                className={cn(
                  "text-muted-foreground h-4 w-4 shrink-0 transition-transform duration-200",
                  !isExpanded && "-rotate-90",
                )}
              />
              {isActive ? (
                <div className="relative">
                  <Activity className="h-3.5 w-3.5 text-green-500" />
                  <div className="absolute right-0 top-0 h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
                </div>
              ) : (
                <div className="relative">
                  <Activity className="text-primary h-3.5 w-3.5" />
                  <div className="bg-primary absolute right-0 top-0 h-1.5 w-1.5 animate-pulse rounded-full" />
                </div>
              )}
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
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="bg-muted/30 border-t">
              {packet.measurements.map((measurement, idx) => (
                <VariableItem
                  key={measurement.id}
                  variable={measurement}
                  packetId={packet.id}
                  liveValue={liveData?.measurementUpdates[measurement.id]}
                  isFirst={idx === 0}
                />
              ))}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    );
  },
  (prevProps, nextProps) => {
    return prevProps.item.id === nextProps.item.id;
  },
);
