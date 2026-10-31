import {
  Button,
  InputGroup,
  InputGroupInput,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  Skeleton,
} from "@hyperloop-upv/frontend-kit/components";
import { Send } from "@hyperloop-upv/frontend-kit/icons";
import { useWebSocket } from "@hyperloop-upv/frontend-kit/hooks";
import { useState } from "react";
import useOrdersCatalog from "../../hooks/useOrdersCatalog";
import { useStore } from "../../store/store";
import OrdersCatalogList from "../../pages/Orders/components/OrdersCatalogList";

/**
 * Side sheet with the classic catalog-style order list (search + outline
 * Send buttons), opened via a header button. The always-visible dashboard
 * Orders panel (OrdersPanel.tsx) keeps the colour-coded grid — this sheet
 * is an additional, searchable view over the same state-machine order set.
 */
const OrdersSheet = () => {
  const { isConnected } = useWebSocket();
  const commandsCatalog = useStore((s) => s.commandsCatalog);
  const [filter, setFilter] = useState("");

  const { loading } = useOrdersCatalog(isConnected);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Send className="size-4" />
          Orders
        </Button>
      </SheetTrigger>
      <SheetContent side="right" style={{ width: "24rem", maxWidth: "24rem" }}>
        <SheetHeader>
          <SheetTitle className="flex items-center gap-1.5">
            <Send className="size-4" />
            Orders
          </SheetTitle>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-4 pb-4">
          <InputGroup>
            <InputGroupInput
              placeholder="Search orders by name or ID…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </InputGroup>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full rounded-lg" />
                ))}
              </div>
            ) : (
              <OrdersCatalogList commandsCatalog={commandsCatalog} filter={filter} isConnected={isConnected} />
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default OrdersSheet;
