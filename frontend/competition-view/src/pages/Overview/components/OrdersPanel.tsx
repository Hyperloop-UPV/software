import { Skeleton } from "@hyperloop-upv/frontend-kit/components";
import { Send } from "@hyperloop-upv/frontend-kit/icons";
import { useWebSocket } from "@hyperloop-upv/frontend-kit/hooks";
import useOrdersCatalog from "../../../hooks/useOrdersCatalog";
import { useStore } from "../../../store/store";
import OrdersList from "../../Orders/components/OrdersList";

const OrdersPanel = () => {
  const { isConnected } = useWebSocket();
  const commandsCatalog = useStore((s) => s.commandsCatalog);

  const { loading } = useOrdersCatalog(isConnected);

  return (
    <div className="bg-card flex shrink-0 flex-col overflow-hidden rounded-xl border shadow-sm">
      <div className="flex shrink-0 items-center gap-2 border-b px-3 py-2">
        <span className="text-muted-foreground flex flex-1 items-center gap-1.5 text-xs font-medium uppercase tracking-widest">
          <Send className="size-3.5" />
          Orders
        </span>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2 p-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="p-2">
          <OrdersList commandsCatalog={commandsCatalog} isConnected={isConnected} />
        </div>
      )}
    </div>
  );
};

export default OrdersPanel;
