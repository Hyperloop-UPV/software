import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@workspace/ui";
import { memo } from "react";
import { useStore } from "../../../../../store/store";
import type { TelemetryCatalogItem } from "../../../../../types/data/telemetryCatalogItem";
import { TelemetryHeader } from "./TelemetryHeader";
import { VariableItem } from "./VariableItem";

interface TelemetryItemProps {
  item: TelemetryCatalogItem;
}

export const TelemetryItem = memo(
  ({ item: telemetryCatalogItem }: TelemetryItemProps) => {
    const isExpanded = useStore((s) =>
      s.isItemExpanded("telemetry", "packet", telemetryCatalogItem.id),
    );
    const toggleExpandedItem = useStore((s) => s.toggleExpandedItem);

    return (
      <Collapsible
        open={isExpanded}
        onOpenChange={() =>
          toggleExpandedItem("telemetry", "packet", telemetryCatalogItem.id)
        }
      >
        <div className="border-b last:border-b-0">
          <CollapsibleTrigger asChild>
            <TelemetryHeader
              telemetryCatalogItem={telemetryCatalogItem}
              isExpanded={isExpanded}
              onToggle={() =>
                toggleExpandedItem(
                  "telemetry",
                  "packet",
                  telemetryCatalogItem.id,
                )
              }
            />
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="bg-muted/30 border-t">
              {telemetryCatalogItem.measurements.map((measurement, index) => (
                <VariableItem
                  key={index}
                  packetId={telemetryCatalogItem.id}
                  variable={measurement}
                />
              ))}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    );
  },
);
