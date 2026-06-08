import { Input, Skeleton } from "@workspace/ui/components";
import { useWebSocket } from "@workspace/ui/hooks";
import { useState } from "react";
import useOrdersCatalog from "../../hooks/useOrdersCatalog";
import { useStore } from "../../store/store";
import BoardSection from "./components/BoardSection";

/**
 * Dynamic orders catalog page.
 *
 * Owns its own catalog fetch so loading state is scoped here.
 * Layout:
 *   - Search input to filter across all boards and order labels/IDs
 *   - Skeleton while the catalog is loading
 *   - One collapsible BoardSection per board
 *   - Empty state if the catalog loaded but returned no boards
 */
const Orders = () => {
  const { isConnected } = useWebSocket();
  const boards          = useStore((s) => s.boards);
  const commandsCatalog = useStore((s) => s.commandsCatalog);
  const [filter, setFilter]     = useState("");

  // Fetch catalog here; refetches on every WS reconnect
  const { loading } = useOrdersCatalog(isConnected);

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto p-4">
      {/* Search */}
      <Input
        placeholder="Search orders by name or ID…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="max-w-sm"
        disabled={loading}
      />

      {/* Board sections */}
      {loading ? (
        <LoadingSkeleton />
      ) : boards.length === 0 ? (
        <div className="flex h-40 items-center justify-center">
          <p className="text-muted-foreground text-sm">
            No orders available — check the backend connection.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {boards.map((boardName) => {
            const board = commandsCatalog[boardName];
            if (!board) return null;
            return (
              <BoardSection key={boardName} board={board} filter={filter} />
            );
          })}
        </div>
      )}
    </div>
  );
};

const LoadingSkeleton = () => (
  <div className="flex flex-col gap-3">
    {Array.from({ length: 4 }).map((_, i) => (
      <Skeleton key={i} className="h-12 w-full rounded-xl" />
    ))}
  </div>
);

export default Orders;
