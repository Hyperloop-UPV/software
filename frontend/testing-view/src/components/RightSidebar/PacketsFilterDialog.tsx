import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Checkbox,
  Button,
} from "@workspace/ui";
import { MOCK_PACKETS, MOCK_PACKET_TYPES } from "../../mocks/data";

interface PacketsFilterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  visiblePacketIds: string[];
  onTogglePacket: (packetId: string) => void;
  onClearAll: () => void;
  onSelectAll: () => void;
}

export const PacketsFilterDialog = ({
  open,
  onOpenChange,
  visiblePacketIds,
  onTogglePacket,
  onClearAll,
  onSelectAll,
}: PacketsFilterDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="min-w-1/3 w-fit">
        <DialogHeader>
          <DialogTitle>Filter Packets</DialogTitle>
          <DialogDescription>Select which packets to display</DialogDescription>
        </DialogHeader>

        <div className="">
          {MOCK_PACKETS.map((packet) => {
            const packetType = MOCK_PACKET_TYPES.find(
              (pt) => pt.id === packet.packetTypeId,
            );
            return (
              <div
                key={packet.id}
                className="hover:bg-accent flex items-center space-x-2 rounded p-2"
              >
                <Checkbox
                  checked={visiblePacketIds.includes(packet.id)}
                  onCheckedChange={() => onTogglePacket(packet.id)}
                />
                <label className="flex-1 cursor-pointer text-sm">
                  <div className="font-semibold">{packetType?.type}</div>
                  <div className="text-muted-foreground text-xs">
                    {packet.timestamp} | {packetType?.size}B
                  </div>
                </label>
              </div>
            );
          })}
        </div>

        <div className="flex justify-between border-t pt-4">
          <Button variant="outline" size="sm" onClick={onClearAll}>
            Clear All
          </Button>
          <Button variant="outline" size="sm" onClick={onSelectAll}>
            Select All
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
