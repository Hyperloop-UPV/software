import {
  Badge,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@workspace/ui/components";
import { ChevronDown } from "@workspace/ui/icons";
import { useState } from "react";
import type { BoardOrdersData, CommandCatalogItem } from "../../../types/catalog";
import OrderItem from "./OrderItem";

interface BoardSectionProps {
  board: BoardOrdersData;
  /** If provided, only orders whose label matches are rendered. */
  filter: string;
  isConnected: boolean;
}

const matchesFilter = (item: CommandCatalogItem, filter: string) => {
  if (!filter) return true;
  const q = filter.toLowerCase();
  return (
    item.name.toLowerCase().includes(q) ||
    String(item.id).includes(q)
  );
};

/**
 * Collapsible section for a single board's orders.
 * Starts collapsed; auto-expands when a search filter is active.
 */
const BoardSection = ({ board, filter, isConnected }: BoardSectionProps) => {
  const [open, setOpen] = useState(false);

  const visibleOrders = board.orders.filter((o) => matchesFilter(o, filter));
  if (visibleOrders.length === 0) return null;

  // Auto-expand when the user is searching
  const isOpen = open || filter.length > 0;

  return (
    <Collapsible open={isOpen} onOpenChange={setOpen}>
      <CollapsibleTrigger className="bg-card hover:bg-accent/30 flex w-full items-center justify-between rounded-t-xl border px-4 py-3 font-medium transition-colors">
        <div className="flex items-center gap-2">
          <span className="text-foreground text-sm font-semibold">
            {board.name}
          </span>
          <Badge variant="secondary" className="text-xs">
            {visibleOrders.length}
          </Badge>
        </div>
        <ChevronDown
          className={`text-muted-foreground size-4 shrink-0 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="bg-card rounded-b-xl border border-t-0">
          {visibleOrders.map((order) => (
            <OrderItem key={order.id} item={order} isConnected={isConnected} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export default BoardSection;
