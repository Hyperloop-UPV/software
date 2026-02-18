import { useMemo } from "react";
import { useShallow } from "zustand/shallow";
import { useStore } from "../../../store/store";
import type { BoardName } from "../../../types/data/board";
import type { SidebarTab } from "../types/sidebar";

export const usePacketRows = (
  scope: SidebarTab,
  categories: readonly BoardName[],
) => {
  const { catalog, filters, expanded, getFlattenedRows } = useStore(
    useShallow((s) => ({
      catalog: s.getCatalog(scope),
      filters: s.getActiveFilters(scope),
      expanded: s.getActiveExpanded(scope),
      getFlattenedRows: s.getFlattenedRows,
    })),
  );

  return useMemo(() => {
    return getFlattenedRows(scope, categories);
  }, [getFlattenedRows, scope, categories, catalog, filters, expanded]);
};
