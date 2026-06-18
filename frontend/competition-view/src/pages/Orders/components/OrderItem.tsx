import {
  Badge,
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components";
import { Check, ChevronDown, Send } from "@workspace/ui/icons";
import { useState } from "react";
import useSendOrder from "../../../hooks/useSendOrder";
import type { CommandCatalogItem, ParameterValues } from "../../../types/catalog";
import type { OrderFieldValue } from "../../../constants/orders";
import OrderParameters from "./OrderParameters";

interface OrderItemProps {
  item: CommandCatalogItem;
  isConnected: boolean;
}

const getDefaultValues = (item: CommandCatalogItem): ParameterValues => {
  const defaults: ParameterValues = {};
  for (const [key, param] of Object.entries(item.fields)) {
    if (param.kind === "numeric")      defaults[key] = "";
    else if (param.kind === "enum")    defaults[key] = param.options[0] ?? "";
    else if (param.kind === "boolean") defaults[key] = false;
  }
  return defaults;
};

/**
 * A single order row with an inline send button.
 * Orders with parameters expand to show a compact form.
 *
 * - Send is disabled while the WS is disconnected or any required numeric field is empty/invalid.
 * - After a successful dispatch the button briefly shows a checkmark.
 */
const OrderItem = ({ item, isConnected }: OrderItemProps) => {
  const sendOrder = useSendOrder();

  const [values, setValues] = useState<ParameterValues>(() => getDefaultValues(item));
  const [open, setOpen]   = useState(false);
  const [sent, setSent]   = useState(false);

  const hasParams = Object.keys(item.fields).length > 0;

  const hasInvalidNumeric = Object.entries(item.fields).some(
    ([key, param]) =>
      param.kind === "numeric" &&
      !Number.isFinite(parseFloat(String(values[key]))),
  );

  const canSend = isConnected && !hasInvalidNumeric && !sent;

  const handleSend = () => {
    if (!canSend) return;

    const fields = Object.entries(item.fields).reduce<Record<string, OrderFieldValue>>(
      (acc, [key, param]) => {
        acc[key] = {
          value:     param.kind === "numeric" ? parseFloat(String(values[key])) : values[key],
          isEnabled: true,
          type:      param.type,
        };
        return acc;
      },
      {},
    );

    sendOrder([{ id: item.id, fields }]);

    // Brief confirmation state
    setSent(true);
    setTimeout(() => setSent(false), 1500);
  };

  const handleParamChange = (key: string, value: string | number | boolean) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const sendButton = (
    <Button
      size="sm"
      variant={sent ? "default" : "outline"}
      disabled={!canSend}
      onClick={(e) => {
        e.stopPropagation();
        handleSend();
      }}
      className={sent ? "border-green-500 bg-green-500 text-white hover:bg-green-600" : ""}
    >
      {sent ? (
        <Check className="mr-1 size-3" />
      ) : (
        <Send className="mr-1 size-3" />
      )}
      {sent ? "Sent" : "Send"}
    </Button>
  );

  // Wrap with tooltip explaining why the button is disabled
  const sendButtonWithTooltip = !isConnected ? (
    <Tooltip>
      <TooltipTrigger asChild>
        <span>{sendButton}</span>
      </TooltipTrigger>
      <TooltipContent>Not connected to backend</TooltipContent>
    </Tooltip>
  ) : hasInvalidNumeric ? (
    <Tooltip>
      <TooltipTrigger asChild>
        <span>{sendButton}</span>
      </TooltipTrigger>
      <TooltipContent>Fill in all required fields first</TooltipContent>
    </Tooltip>
  ) : (
    sendButton
  );

  if (!hasParams) {
    return (
      <div className="flex items-center justify-between gap-3 border-b px-4 py-2 last:border-0">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-foreground truncate text-sm font-medium">{item.name}</span>
          <Badge variant="outline" className="shrink-0 font-mono text-xs">{item.id}</Badge>
        </div>
        {sendButtonWithTooltip}
      </div>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="hover:bg-accent/50 flex w-full items-center justify-between gap-3 border-b px-4 py-2 transition-colors last:border-0">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-foreground truncate text-sm font-medium">{item.name}</span>
          <Badge variant="outline" className="shrink-0 font-mono text-xs">{item.id}</Badge>
          <Badge variant="secondary" className="shrink-0 text-xs">
            {Object.keys(item.fields).length} params
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {sendButtonWithTooltip}
          <ChevronDown
            className={`text-muted-foreground size-4 shrink-0 transition-transform duration-200 ${
              open ? "rotate-180" : ""
            }`}
          />
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="bg-muted/30 border-b px-4 py-3">
          <OrderParameters
            fields={item.fields}
            values={values}
            onChange={handleParamChange}
          />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export default OrderItem;
