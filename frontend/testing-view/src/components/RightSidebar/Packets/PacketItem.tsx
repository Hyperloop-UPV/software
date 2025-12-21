import type { Packet } from "../../../types/Packet";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@workspace/ui";
import { ChevronDown, ChevronRight } from "@workspace/ui/icons";
import { VariableItem } from "./VariableItem";
import { useStore } from "../../../store/store";

interface PacketItemProps {
  item: Packet;
}

export const PacketItem = ({ item: packet }: PacketItemProps) => {
  const isExpanded = useStore((s) => s.isItemExpanded("packets", packet.id));
  const toggleExpandedItem = useStore((s) => s.toggleExpandedItem);

  return (
    <Collapsible
      open={isExpanded}
      onOpenChange={() => toggleExpandedItem("packets", packet.id)}
    >
      <div className="">
        {/* Packet Header - Collapsible Trigger */}
        <CollapsibleTrigger className="hover:bg-accent/30 flex w-full items-center justify-between gap-2 px-2.5 py-2.5 transition-colors">
          <div className="flex items-center gap-2">
            {isExpanded ? (
              <ChevronDown className="text-muted-foreground h-4 w-4 shrink-0" />
            ) : (
              <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" />
            )}
            <span className="text-foreground truncate text-sm font-medium">
              {packet.label}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground shrink-0 text-xs">
              {packet.cycleTime}
            </span>
          </div>
        </CollapsibleTrigger>

        {/* Variables List - Collapsible Content */}
        <CollapsibleContent>
          <div className="bg-muted/20">
            {packet.measurements.map((measurement) => (
              <VariableItem key={measurement.id} variable={measurement} />
            ))}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};
