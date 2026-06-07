import { Input, Skeleton } from "@workspace/ui/components";
import { useState } from "react";
import { useStore } from "../../store/store";
import BoardSection from "./components/BoardSection";

interface OrdersProps {
  /** Whether the backend WebSocket is currently connected. */
  isConnected: boolean;
}

/**
 * Dynamic orders catalog page.
 *
 * Layout:
 *   - Search input to filter across all boards and order labels/IDs
 *   - One collapsible BoardSection per board
 *   - Skeleton loading state while the catalog is being fetched
 */
const Orders = ({ isConnected: _isConnected }: OrdersProps) => {
  const boards = useStore((s) => s.boards);
  const commandsCatalog = useStore((s) => s.commandsCatalog);
  const [filter, setFilter] = useState("");

  const isLoading = boards.length === 0;

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto p-4">
      {/* Search */}
      <Input
        placeholder="Search orders by name or ID…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="max-w-sm"
      />

      {/* Board sections */}
      {isLoading ? (
        <LoadingSkeleton />
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
