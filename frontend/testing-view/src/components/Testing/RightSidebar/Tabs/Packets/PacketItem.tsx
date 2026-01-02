import {
  Badge,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Separator,
} from "@workspace/ui";
import { Activity, ChevronDown } from "@workspace/ui/icons";
import { cn } from "@workspace/ui/lib";
import { memo, useEffect, useRef, useState } from "react";
import { useStore } from "../../../../../store/store";
import type { Packet } from "../../../../../types/data/packet";
import { VariableItem } from "./VariableItem";
import { PacketHeader } from "./PacketHeader";

interface PacketItemProps {
  item: Packet;
}

export const PacketItem = memo(({ item: packet }: PacketItemProps) => {
  const isExpanded = useStore((s) => s.isItemExpanded("packets", packet.id));
  const toggleExpandedItem = useStore((s) => s.toggleExpandedItem);

  return (
    <Collapsible
      open={isExpanded}
      onOpenChange={() => toggleExpandedItem("packets", packet.id)}
    >
      <div className="border-b last:border-b-0">
        <CollapsibleTrigger asChild>
          <PacketHeader
            packet={packet}
            isExpanded={isExpanded}
            onToggle={() => toggleExpandedItem("packets", packet.id)}
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
