// frontend/testing-view/src/components/common/VirtualizedList.tsx
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@workspace/ui/lib";
import { useCallback, useRef } from "react";
import { usePacketRows } from "../../../../hooks/usePacketRows";
import type { BoardName } from "../../../../types/data/board";
import type { VirtualRow } from "../../../../types/data/virtualization";
import type { SidebarTab } from "../../../../types/workspace/sidebar";
import { TelemetryRow } from "./Telemetry/TelemetryRow";

interface VirtualizedListProps {
  className?: string;
  scope: SidebarTab;
  categories: readonly BoardName[];
}

export const VirtualizedList = ({
  scope,
  categories,
  className,
}: VirtualizedListProps) => {
  const parentRef = useRef<HTMLDivElement>(null);
  const rows = usePacketRows(scope, categories);

  const estimateSize = useCallback((row: VirtualRow) => {
    if (row.type === "board") return 50; // Board list item height
    if (row.type === "packet") return 42; // Packet list item height
    return 48.8; // Variable list item height
  }, []);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => estimateSize(rows[index]),
    getItemKey: useCallback((index: number) => rows[index].id, [rows]),
    overscan: 3,
  });

  return (
    <div
      ref={parentRef}
      className={cn("custom-scrollbar h-full overflow-y-auto", className)}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
        }}
        className="relative w-full"
      >
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.key}
            className="absolute left-0 top-0 w-full px-0.5"
            style={{
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`,
              willChange: "transform",
              contain: "content",
            }}
          >
            <TelemetryRow row={rows[virtualRow.index]} />
          </div>
        ))}
      </div>
    </div>
  );
};
