import {
  Badge,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Separator,
} from "@workspace/ui";
import { ChevronDown, ChevronRight } from "@workspace/ui/icons";
import { useStore } from "../../../../../store/store";
import type { Packet } from "../../../../../types/data/packet";
import { VariableItem } from "./VariableItem";

interface PacketItemProps {
  item: Packet;
}

export const PacketItem = ({ item: packet }: PacketItemProps) => {
  const isExpanded = useStore((s) => s.isItemExpanded("packets", packet.id));
  const toggleExpandedItem = useStore((s) => s.toggleExpandedItem);

  const liveData = useStore((s) => s.telemetry[packet.id]);

  return (
    <Collapsible
      open={isExpanded}
      onOpenChange={() => toggleExpandedItem("packets", packet.id)}
    >
      <div className="">
        {/* Packet Header - Collapsible Trigger */}
        <CollapsibleTrigger className="hover:bg-accent/30 flex w-full items-center justify-between gap-2 px-2.5 py-2.5 transition-colors">
          <div className="flex flex-1 items-center gap-2">
            {isExpanded ? (
              <ChevronDown className="text-muted-foreground h-4 w-4 shrink-0" />
            ) : (
              <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" />
            )}
            <span className="text-foreground max-w-1/2 truncate text-sm font-medium">
              {packet.label}
            </span>
            <Badge variant="secondary">{packet.id}</Badge>
          </div>
          <div className="flex items-center gap-2">
            {liveData && (
              <span className="text-muted-foreground shrink-0 text-xs">
                #{liveData?.count}
              </span>
            )}
            <Separator orientation="vertical" />
            {liveData && (
              <span className="text-muted-foreground shrink-0 text-xs">
                {`${liveData?.cycleTime} ms`}
              </span>
            )}
          </div>
        </CollapsibleTrigger>

        {/* Variables List - Collapsible Content */}
        <CollapsibleContent>
          <div className="bg-muted/20">
            {packet.measurements.map((measurement) => (
              <VariableItem
                key={measurement.id}
                variable={measurement}
                packetId={packet.id}
                liveValue={liveData?.measurementUpdates[measurement.id]}
              />
            ))}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};
