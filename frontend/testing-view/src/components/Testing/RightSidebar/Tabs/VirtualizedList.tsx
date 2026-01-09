// frontend/testing-view/src/components/common/VirtualizedList.tsx
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@workspace/ui/lib";
import { useCallback, useRef, type ReactNode } from "react";
import type { VirtualRow } from "../../../../types/data/virtualization";

interface VirtualizedListProps<T> {
  rows: T[];
  estimateSize: (row: T) => number;
  renderRow: (row: T, index: number) => ReactNode;
  className?: string;
}

export const VirtualizedList = <T extends VirtualRow>({
  rows,
  estimateSize,
  renderRow,
  className,
}: VirtualizedListProps<T>) => {
  const parentRef = useRef<HTMLDivElement>(null);

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
          width: "100%",
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.key}
            className="absolute left-0 top-0 w-full"
            style={{
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`,
              willChange: "transform",
              contain: "content",
            }}
          >
            {renderRow(rows[virtualRow.index], virtualRow.index)}
          </div>
        ))}
      </div>
    </div>
  );
};
