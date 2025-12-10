import type { Packet } from "../../../types/Packet";

interface PacketItemProps {
  item: Packet;
}

export const PacketItem = ({ item: packet }: PacketItemProps) => {
  return (
    <div className="flex border">
      <span className="text-foreground">{packet.name}</span>
      <span className="text-foreground">{packet.value}</span>
      <span className="text-muted-foreground">{packet.unit}</span>
      <span className="text-muted-foreground">{packet.timestamp}</span>
    </div>
  );
};
