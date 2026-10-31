import { Button } from "@hyperloop-upv/frontend-kit/components";
import type { BoardOrdersData } from "../../../types/catalog";
import { BOARDS, VCU } from "../../../constants/measurements";
import {
  isVcuOrderAllowedInState,
  VCU_GATED_ORDER_IDS,
  VCU_MAX_ORDERS_PER_STATE,
} from "../../../constants/vcuStateMachine";
import { VCU_ORDER_COLOR_LEVELS } from "../../../constants/orderColors";
import useMeasurement from "../../../hooks/useMeasurement";
import OrderButton from "./OrderButton";

const FAULT_ORDER_ID = 0;

interface OrdersListProps {
  /** Full catalog, keyed by board name (as received from the backend). */
  commandsCatalog: Record<string, BoardOrdersData>;
  isConnected: boolean;
}

/**
 * VCU order action panel, built from the vehicle state machine (see
 * constants/vcuStateMachine.ts): only orders valid in the current state
 * are shown (rather than shown-but-disabled), each colour-coded by what
 * it does to the vehicle's safety posture (constants/orderColors.ts).
 * FAULT is always available and pinned as a big red button at the bottom,
 * regardless of state.
 *
 * The grid always reserves VCU_MAX_ORDERS_PER_STATE slots (filled with
 * invisible placeholders past the current state's count) so the panel's
 * height is exactly what the worst-case state needs — no more, and no
 * growing/shrinking as the vehicle transitions between states.
 */
const OrdersList = ({ commandsCatalog, isConnected }: OrdersListProps) => {
  const vcuState  = useMeasurement(BOARDS.VCU, VCU.state) as string | undefined;
  const vcuOrders = commandsCatalog[BOARDS.VCU]?.orders ?? [];

  // Name comes from the catalog when available, but the button itself never
  // depends on the catalog having loaded — FAULT (id 0) is always sendable.
  const faultName = vcuOrders.find((o) => o.id === FAULT_ORDER_ID)?.name ?? "Fault";

  const availableOrders = VCU_GATED_ORDER_IDS
    .filter((id) => id !== FAULT_ORDER_ID)
    .map((id) => vcuOrders.find((o) => o.id === id))
    .filter((o): o is NonNullable<typeof o> => o !== undefined)
    .filter((o) => isVcuOrderAllowedInState(o.id, vcuState));

  const placeholderCount = Math.max(0, VCU_MAX_ORDERS_PER_STATE - availableOrders.length);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <div className="grid grid-cols-2 gap-2">
          {availableOrders.map((order) => (
            <OrderButton
              key={order.id}
              id={order.id}
              name={order.name}
              level={VCU_ORDER_COLOR_LEVELS[order.id] ?? "neutral"}
              isConnected={isConnected}
            />
          ))}
          {Array.from({ length: placeholderCount }).map((_, i) => (
            <Button key={`slot-${i}`} disabled tabIndex={-1} aria-hidden className="invisible">
              placeholder
            </Button>
          ))}
        </div>

        {availableOrders.length === 0 && (
          <p className="text-muted-foreground absolute inset-0 flex items-center justify-center p-2 text-center text-sm">
            {vcuState ? `No orders available in state "${vcuState}".` : "Waiting for vehicle state…"}
          </p>
        )}
      </div>

      <OrderButton
        id={FAULT_ORDER_ID}
        name={faultName}
        level="danger"
        isConnected={isConnected}
        prominent
      />
    </div>
  );
};

export default OrdersList;
