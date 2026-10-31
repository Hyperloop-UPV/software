import { Skeleton } from "@hyperloop-upv/frontend-kit/components";
import { useWebSocket } from "@hyperloop-upv/frontend-kit/hooks";
import useOrdersCatalog from "../../hooks/useOrdersCatalog";
import { useStore } from "../../store/store";
import OrdersList from "./components/OrdersList";

/**
 * VCU order action panel page.
 *
 * Owns its own catalog fetch so loading state is scoped here.
 * Renders only the orders defined by the vehicle state machine
 * (see constants/vcuStateMachine.ts), filtered to what the current
 * vehicle state allows, plus an always-available FAULT button.
 */
const Orders = () => {
  const { isConnected } = useWebSocket();
  const commandsCatalog = useStore((s) => s.commandsCatalog);

  // Fetch catalog here; refetches on every WS reconnect
  const { loading } = useOrdersCatalog(isConnected);

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      {loading ? (
        <LoadingSkeleton />
      ) : (
        <OrdersList commandsCatalog={commandsCatalog} isConnected={isConnected} />
      )}
    </div>
  );
};

const LoadingSkeleton = () => (
  <div className="flex flex-col gap-3">
    {Array.from({ length: 4 }).map((_, i) => (
      <Skeleton key={i} className="h-12 w-full rounded-xl" />
    ))}
  </div>
);

export default Orders;
