import { memo, useCallback } from "react";
import { useStore } from "../../../../../store/store";
import type { VirtualRow } from "../../../../../types/data/virtualization";
import { CategoryHeader } from "../CategoryHeader";
import { PacketHeader } from "./PacketHeader";
import { VariableItem } from "./VariableItem";

interface PacketRowProps {
  row: VirtualRow;
}

export const PacketRow = memo(({ row }: PacketRowProps) => {
  const isExpanded = useStore((s) =>
    s.isItemExpanded("packets", row.type, row.id),
  );
  const toggleExpandedItem = useStore((s) => s.toggleExpandedItem);

  const handleToggle = useCallback(() => {
    toggleExpandedItem("packets", row.type, row.id);
  }, [toggleExpandedItem, row.id]);

  if (row.type === "board") {
    return (
      <CategoryHeader
        name={row.label}
        count={row.count}
        isExpanded={isExpanded}
        onToggle={handleToggle}
      />
    );
  }

  if (row.type === "packet") {
    return (
      <div className="border-accent/20 h-full w-full border-l-2">
        <PacketHeader
          packet={row.data}
          isExpanded={isExpanded}
          onToggle={handleToggle}
        />
      </div>
    );
  }

  return (
    <div className="border-accent/10 h-full w-full border-l-2">
      <VariableItem variable={row.data} packetId={row.packetId} />
    </div>
  );
});
