import { Button } from "@workspace/ui";
import { MOCK_PACKETS, MOCK_PACKET_TYPES } from "../../mocks/data";
import type { Packet } from "../../mocks/data";

interface PacketsTabProps {
  visiblePackets: Packet[];
  totalPackets: number;
  onOpenFilter: () => void;
}

export const PacketsTab = ({
  visiblePackets,
  totalPackets,
  onOpenFilter,
}: PacketsTabProps) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">Network Monitor</h3>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onOpenFilter}
        >
          <span>✏️</span>
        </Button>
      </div>

      <p className="text-muted-foreground text-sm">
        Showing {visiblePackets.length} of {totalPackets} packets
      </p>

      <div className="space-y-2">
        {visiblePackets.map((packet) => {
          const packetType = MOCK_PACKET_TYPES.find(
            (pt) => pt.id === packet.packetTypeId,
          );
          return (
            <div key={packet.id} className="rounded border p-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-mono font-semibold">
                  {packetType?.type}
                </span>
                <span className="text-muted-foreground">
                  {packet.timestamp}
                </span>
              </div>
              <div className="text-muted-foreground mt-1">
                {packet.source} → {packet.destination} | {packetType?.size}B |{" "}
                {packet.status}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
