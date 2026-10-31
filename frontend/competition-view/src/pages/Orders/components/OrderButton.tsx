import { Button, Tooltip, TooltipContent, TooltipTrigger } from "@hyperloop-upv/frontend-kit/components";
import { AlertTriangle, Check, Send } from "@hyperloop-upv/frontend-kit/icons";
import { useState } from "react";
import useSendOrder from "../../../hooks/useSendOrder";
import { orderButtonColorClass, type OrderColorLevel } from "../../../constants/orderColors";

interface OrderButtonProps {
  id: number;
  name: string;
  level: OrderColorLevel;
  isConnected: boolean;
  /** Renders full-width with larger text — used for the FAULT button. */
  prominent?: boolean;
}

/**
 * A single colour-coded order button. Sends a field-less VCU order (all
 * orders in the state-machine gated set take no parameters) and briefly
 * shows a checkmark on dispatch.
 */
const OrderButton = ({ id, name, level, isConnected, prominent = false }: OrderButtonProps) => {
  const sendOrder = useSendOrder();
  const [sent, setSent] = useState(false);

  const canSend = isConnected && !sent;

  const handleSend = () => {
    if (!canSend) return;
    sendOrder([{ id, fields: {} }]);
    setSent(true);
    setTimeout(() => setSent(false), 1500);
  };

  const button = (
    <Button
      disabled={!canSend}
      onClick={handleSend}
      className={`gap-1.5 border font-semibold ${prominent ? "h-14 w-full text-base" : ""} ${
        sent ? "border-green-500 bg-green-500 text-white hover:bg-green-600" : orderButtonColorClass(level)
      }`}
    >
      {sent ? (
        <Check className="size-4" />
      ) : prominent ? (
        <AlertTriangle className="size-5" />
      ) : (
        <Send className="size-3.5" />
      )}
      {sent ? "Sent" : name}
    </Button>
  );

  if (isConnected) return button;

  return (
    <Tooltip>
      <TooltipTrigger asChild><span className={prominent ? "block" : ""}>{button}</span></TooltipTrigger>
      <TooltipContent>Not connected to backend</TooltipContent>
    </Tooltip>
  );
};

export default OrderButton;
