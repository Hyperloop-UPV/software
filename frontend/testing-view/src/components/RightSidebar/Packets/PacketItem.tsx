import type { Packet } from "../../../types/Packet";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@workspace/ui";
import { ChevronDown, ChevronRight } from "@workspace/ui/icons";
import { VariableItem } from "./VariableItem";
import { usePacketsStore } from "../../../store/usePacketsStore";

interface PacketItemProps {
  item: Packet;
}

export const PacketItem = ({ item: packet }: PacketItemProps) => {
  const isItemExpanded = usePacketsStore((s) => s.isItemExpanded);
  const toggleExpandedItem = usePacketsStore((s) => s.toggleExpandedItem);

  const isExpanded = isItemExpanded(packet.id);
  const handleToggleExpanded = () => toggleExpandedItem(packet.id);

  return (
    <Collapsible open={isExpanded} onOpenChange={handleToggleExpanded}>
      <div className="">
        {/* Packet Header - Collapsible Trigger */}
        <CollapsibleTrigger className="hover:bg-accent/30 flex w-full items-center justify-between gap-2 px-2.5 py-2.5 transition-colors">
          <div className="flex items-center gap-2">
            {isExpanded ? (
              <ChevronDown className="text-muted-foreground h-4 w-4 shrink-0" />
            ) : (
              <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" />
            )}
            <span className="foreground truncate text-sm font-medium">
              {packet.name}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground shrink-0 text-xs font-medium">
              {packet.variables.length} var
              {packet.variables.length !== 1 ? "s" : ""}
            </span>
            <span className="text-muted-foreground shrink-0 text-xs">
              {packet.timestamp}
            </span>
          </div>
        </CollapsibleTrigger>

        {/* Variables List - Collapsible Content */}
        <CollapsibleContent>
          <div className="bg-muted/20">
            {packet.variables.map((variable) => (
              <VariableItem key={variable.id} variable={variable} />
            ))}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};
