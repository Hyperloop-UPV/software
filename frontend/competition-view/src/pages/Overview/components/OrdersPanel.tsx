import { Button, Separator } from "@workspace/ui/components";
import { useState } from "react";
import {
  BRAKE_ORDERS,
  EMERGENCY_STOP_ORDERS,
  OPEN_CONTACTORS_ORDERS,
} from "../../../constants/orders";
import useSendOrder from "../../../hooks/useSendOrder";

/**
 * Panel of hardcoded competition orders.
 *
 * The Emergency Stop button requires two consecutive clicks within 2 seconds
 * to prevent accidental activation. All other buttons fire on single click.
 */
const OrdersPanel = () => {
  const sendOrder = useSendOrder();

  return (
    <div className="bg-card flex flex-col rounded-xl border shadow-sm">
      <div className="px-4 py-3">
        <span className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
          Quick Orders
        </span>
      </div>
      <Separator />

      <div className="flex flex-wrap gap-3 p-4">
        <Button
          variant="outline"
          onClick={() => sendOrder(BRAKE_ORDERS)}
          title="Engage brakes (ID 215)"
        >
          Brake
        </Button>

        <Button
          variant="outline"
          className="border-amber-500 text-amber-600 hover:bg-amber-500/10 dark:text-amber-400"
          onClick={() => sendOrder(OPEN_CONTACTORS_ORDERS)}
          title="Cut HV power (ID 902)"
        >
          Open Contactors
        </Button>

        <EmergencyStopButton onConfirm={() => sendOrder(EMERGENCY_STOP_ORDERS)} />
      </div>
    </div>
  );
};

/**
 * Emergency Stop requires two clicks within 2 s to prevent accidents.
 * After the first click the button enters an "armed" state.
 */
const EmergencyStopButton = ({ onConfirm }: { onConfirm: () => void }) => {
  const [armed, setArmed] = useState(false);

  const handleClick = () => {
    if (armed) {
      onConfirm();
      setArmed(false);
      return;
    }
    setArmed(true);
    setTimeout(() => setArmed(false), 2000);
  };

  return (
    <Button
      variant="outline"
      onClick={handleClick}
      className={
        armed
          ? "animate-pulse border-red-600 bg-red-600 text-white hover:bg-red-700"
          : "border-red-500 text-red-600 hover:bg-red-500/10 dark:text-red-400"
      }
    >
      {armed ? "⚠ Click again to confirm" : "⚠ Emergency Stop"}
    </Button>
  );
};

export default OrdersPanel;
