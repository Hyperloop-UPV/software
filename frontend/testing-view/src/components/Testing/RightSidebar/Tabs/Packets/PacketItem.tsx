import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@workspace/ui";
import { memo } from "react";
import { useStore } from "../../../../../store/store";
import type { Packet } from "../../../../../types/data/packet";
import { PacketHeader } from "./PacketHeader";
import { VariableItem } from "./VariableItem";

interface PacketItemProps {
  item: Packet;
}

export const PacketItem = memo(({ item: packet }: PacketItemProps) => {
  const isExpanded = useStore((s) =>
    s.isItemExpanded("telemetry", "packet", packet.id),
  );
  const toggleExpandedItem = useStore((s) => s.toggleExpandedItem);

  return (
    <Collapsible
      open={isExpanded}
      onOpenChange={() => toggleExpandedItem("telemetry", "packet", packet.id)}
    >
      <div className="border-b last:border-b-0">
        <CollapsibleTrigger asChild>
          <PacketHeader
            packet={packet}
            isExpanded={isExpanded}
            onToggle={() =>
              toggleExpandedItem("telemetry", "packet", packet.id)
            }
          />
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="bg-muted/30 border-t">
            {packet.measurements.map((measurement, index) => (
              <VariableItem
                key={index}
                packetId={packet.id}
                variable={measurement}
              />
            ))}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
});
