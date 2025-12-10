import type { Packet } from "../../../types/Packet";

interface PacketItemProps {
  item: Packet;
}

export const PacketItem = ({ item: packet }: PacketItemProps) => {
  return (
    <div className="hover:bg-accent/30 flex items-center gap-2 border-b px-2 py-1 transition-colors last:border-b-0">
      <span className="text-foreground flex-1 truncate text-xs font-medium">
        {packet.name}
      </span>
      <span className="text-foreground shrink-0 font-mono text-xs">
        {packet.value}
      </span>
      <span className="text-muted-foreground min-w-8 shrink-0 text-[10px]">
        {packet.unit}
      </span>
      <span className="text-muted-foreground shrink-0 text-[10px]">
        {packet.timestamp}
      </span>
    </div>
  );
};
