import { useFetchConfig } from "@workspace/ui/hooks";
import { useEffect } from "react";
import { useStore } from "../store/store";
import type { OrdersData } from "../types/catalog";

const BACKEND_URL =
  (import.meta.env.VITE_BACKEND_URL as string | undefined) ??
  "http://127.0.0.1:4000/backend";

/**
 * Fetches the orders catalog from the backend and stores it in Zustand.
 * Automatically refetches whenever the WebSocket reconnects.
 */
const useOrdersCatalog = (isConnected: boolean) => {
  const setCommandsCatalog = useStore((s) => s.setCommandsCatalog);
  const setBoards = useStore((s) => s.setBoards);

  const { data, loading, refetch } = useFetchConfig<OrdersData>(
    BACKEND_URL,
    "orderStructures",
  );

  // Refetch every time the WebSocket connects (backend may have restarted)
  useEffect(() => {
    if (isConnected) refetch();
  }, [isConnected, refetch]);

  // Populate the store whenever new data arrives
  useEffect(() => {
    if (!data) return;

    const catalog: ReturnType<typeof useStore.getState>["commandsCatalog"] = {};
    const boardNames: string[] = [];

    for (const board of data.boards) {
      if (board.orders.length === 0) continue;
      catalog[board.name] = board;
      boardNames.push(board.name);
    }

    setCommandsCatalog(catalog);
    setBoards(boardNames.sort());
  }, [data, setCommandsCatalog, setBoards]);

  return { loading };
};

export default useOrdersCatalog;
