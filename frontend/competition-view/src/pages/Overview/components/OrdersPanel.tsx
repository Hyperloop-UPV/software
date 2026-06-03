import { Separator } from "@workspace/ui/components";
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
        <ActionButton
          label="Brake"
          description="Engage brakes (ID 215)"
          variant="secondary"
          onClick={() => sendOrder(BRAKE_ORDERS)}
        />
        <ActionButton
          label="Open Contactors"
          description="Cut HV power (ID 902)"
          variant="warning"
          onClick={() => sendOrder(OPEN_CONTACTORS_ORDERS)}
        />
        <EmergencyStopButton onConfirm={() => sendOrder(EMERGENCY_STOP_ORDERS)} />
      </div>
    </div>
  );
};

/* ─── Sub-components ──────────────────────────────────────────────────── */

type ButtonVariant = "secondary" | "warning";

interface ActionButtonProps {
  label: string;
  description: string;
  variant: ButtonVariant;
  onClick: () => void;
}

const VARIANT_STYLES: Record<ButtonVariant, string> = {
  secondary:
    "border-border bg-secondary text-secondary-foreground hover:bg-secondary/80",
  warning:
    "border-amber-500 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 dark:text-amber-400",
};

const ActionButton = ({
  label,
  description,
  variant,
  onClick,
}: ActionButtonProps) => (
  <button
    onClick={onClick}
    title={description}
    className={`flex flex-col items-start rounded-lg border px-4 py-3 text-left transition-colors ${VARIANT_STYLES[variant]}`}
  >
    <span className="text-sm font-semibold">{label}</span>
    <span className="text-xs opacity-60">{description}</span>
  </button>
);

/**
 * Emergency Stop requires two clicks within 2 s to prevent accidents.
 * After the first click the button enters an "armed" state with a countdown.
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
    <button
      onClick={handleClick}
      className={`flex flex-col items-start rounded-lg border px-4 py-3 text-left transition-all ${
        armed
          ? "animate-pulse border-red-600 bg-red-600 text-white"
          : "border-red-500 bg-red-500/10 text-red-600 hover:bg-red-500/20 dark:text-red-400"
      }`}
    >
      <span className="text-sm font-semibold">
        {armed ? "⚠ Click again to confirm" : "⚠ Emergency Stop"}
      </span>
      <span className="text-xs opacity-70">
        {armed ? "Armed — 2 s window" : "IDs: 55, 1799, 1698, 0"}
      </span>
    </button>
  );
};

export default OrdersPanel;
