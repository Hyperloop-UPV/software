import type { ComponentType } from "react";
import { usePacketRows } from "../../../../hooks/usePacketRows";
import { useStore } from "../../../../store/store";
import type { Item } from "../../../../types/common/item";
import type { BoardName } from "../../../../types/data/board";
import type { SidebarTab } from "../../../../types/workspace/sidebar";
import { EmptyTab } from "./EmptyTab";
import { PacketRow } from "./Packets/PacketRow";
import { StandardList } from "./StandardList";
import { TabHeader } from "./TabHeader";
import { VirtualizedList } from "./VirtualizedList";

interface TabProps {
  title: string;
  scope: SidebarTab;
  categories: readonly BoardName[];
  ItemComponent: ComponentType<{ item: Item }>;
  virtualized?: boolean;
}

export const Tab = ({
  title,
  scope,
  categories,
  ItemComponent,
  virtualized,
}: TabProps) => {
  const filteredCount = useStore((state) => state.getFilteredCount(scope));
  const packetRows = usePacketRows(categories);
  const openFilterDialog = useStore((state) => state.openFilterDialog);

  return (
    <div className="flex h-full flex-col">
      <TabHeader title={title} scope={scope} />

      {filteredCount === 0 ? (
        <EmptyTab title={title} onOpenFilter={() => openFilterDialog(scope)} />
      ) : (
        <div className="flex-1 overflow-hidden">
          {virtualized ? (
            <VirtualizedList
              rows={packetRows}
              estimateSize={(row) => {
                if (row.type === "category") return 50;
                if (row.type === "packet") return 42;
                return 48.8;
              }}
              renderRow={(row) => <PacketRow row={row} />}
            />
          ) : (
            <StandardList
              scope={scope}
              categories={categories}
              ItemComponent={ItemComponent}
            />
          )}
        </div>
      )}
    </div>
  );
};
