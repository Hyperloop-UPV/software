import { useFetchConfig, useWebSocket } from "@hyperloop-upv/frontend-kit/hooks";
import { useEffect } from "react";
import { useStore } from "../store/store";

interface PodPacket { id: number }
interface PodBoard  { name: string; packets: PodPacket[] }
interface PodDataStructure { boards: PodBoard[] }

const BACKEND_URL =
  (import.meta.env.VITE_BACKEND_URL as string | undefined) ??
  "http://127.0.0.1:4000/backend";

/**
 * Fetches `podDataStructure` on every WebSocket connect and populates the
 * `packetBoard` map (packetId → boardName) used by `updateTelemetry` to
 * scope measurements under the correct board, preventing collisions between
 * boards that share measurement names.
 */
const usePodCatalog = () => {
  const { isConnected } = useWebSocket();
  const setPacketBoard  = useStore((s) => s.setPacketBoard);

  const { data, refetch } = useFetchConfig<PodDataStructure>(
    BACKEND_URL,
    "podDataStructure",
  );

  useEffect(() => {
    if (isConnected) refetch();
  }, [isConnected, refetch]);

  useEffect(() => {
    if (!data) return;
    const map: Record<number, string> = {};
    for (const board of data.boards) {
      for (const packet of board.packets) {
        map[packet.id] = board.name;
      }
    }
    setPacketBoard(map);
  }, [data, setPacketBoard]);
};

export default usePodCatalog;
