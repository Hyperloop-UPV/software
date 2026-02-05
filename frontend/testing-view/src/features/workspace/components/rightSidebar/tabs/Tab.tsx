import { type ComponentType } from "react";
import { useStore } from "../../../../../store/store";
import type { CatalogItem } from "../../../../../types/common/item";
import type { BoardName } from "../../../../../types/data/board";
import type { SidebarTab } from "../../../types/sidebar";
import { EmptyTab } from "./EmptyTab";
import { StandardList } from "./StandardList";
import { TabHeader } from "./TabHeader";
import { VirtualizedList } from "./VirtualizedList";

interface TabProps {
  title: string;
  scope: SidebarTab;
  categories: readonly BoardName[];
  ItemComponent: ComponentType<{ item: CatalogItem }>;
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
  const openFilterDialog = useStore((state) => state.openFilterDialog);

  return (
    <div className="flex h-full flex-col">
      <TabHeader title={title} scope={scope} />

      {filteredCount === 0 ? (
        <EmptyTab title={title} onOpenFilter={() => openFilterDialog(scope)} />
      ) : (
        <div className="flex-1 overflow-hidden">
          {virtualized ? (
            <VirtualizedList scope={scope} categories={categories} />
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
