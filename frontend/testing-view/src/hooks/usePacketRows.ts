import { useMemo } from "react";
import { useShallow } from "zustand/shallow";
import { useStore } from "../store/store";
import type { BoardName } from "../types/data/board";
import type { Packet } from "../types/data/packet";
import type { VirtualRow } from "../types/data/virtualization";

export const usePacketRows = (categories: readonly BoardName[]) => {
  const activeWorkspaceId = useStore((s) => s.getActiveWorkspaceId() ?? "");
  const expanded = useStore(
    useShallow((s) => s.expandedItems[activeWorkspaceId]?.["packets"]),
  );
  const getFiltered = useStore((s) => s.getFilteredItemsByCategory);

  const packets = useStore((s) => s.packets);
  const filters = useStore((s) => s.tabFilters);

  return useMemo(() => {
    const rows: VirtualRow[] = [];
    categories.forEach((category) => {
      const items = getFiltered("packets", category) as Packet[];
      if (items.length === 0) return;

      rows.push({
        type: "category",
        id: category,
        label: category,
        count: items.length,
      });

      if (expanded?.has(category)) {
        items.forEach((packet) => {
          rows.push({ type: "packet", id: packet.id, data: packet });
          if (expanded?.has(packet.id)) {
            packet.measurements.forEach((m) => {
              rows.push({
                type: "variable",
                id: `${packet.id}-${m.id}`,
                data: m,
                packetId: packet.id,
              });
            });
          }
        });
      }
    });
    return rows;
  }, [categories, expanded, packets, filters]);
};
