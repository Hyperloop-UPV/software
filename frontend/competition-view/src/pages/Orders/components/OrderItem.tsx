import {
  Badge,
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@workspace/ui/components";
import { ChevronDown, Send } from "@workspace/ui/icons";
import { useState } from "react";
import useSendOrder from "../../../hooks/useSendOrder";
import type { CommandCatalogItem, ParameterValues } from "../../../types/catalog";
import OrderParameters from "./OrderParameters";

interface OrderItemProps {
  item: CommandCatalogItem;
}

const getDefaultValues = (item: CommandCatalogItem): ParameterValues => {
  const defaults: ParameterValues = {};
  for (const [key, param] of Object.entries(item.fields)) {
    if (param.kind === "numeric")  defaults[key] = "";
    else if (param.kind === "enum") defaults[key] = param.options[0] ?? "";
    else if (param.kind === "boolean") defaults[key] = false;
  }
  return defaults;
};

/**
 * A single order row with an inline send button.
 * Orders with parameters expand to show a compact form.
 */
const OrderItem = ({ item }: OrderItemProps) => {
  const sendOrder = useSendOrder();
  const [values, setValues] = useState<ParameterValues>(() =>
    getDefaultValues(item),
  );
  const [open, setOpen] = useState(false);

  const hasParams = Object.keys(item.fields).length > 0;

  const hasInvalidNumeric = Object.entries(item.fields).some(
    ([key, param]) =>
      param.kind === "numeric" && !Number.isFinite(parseFloat(String(values[key]))),
  );

  const handleSend = () => {
    const fields = Object.entries(item.fields).reduce(
      (acc, [key, param]) => {
        acc[key] = {
          value:
            param.kind === "numeric"
              ? parseFloat(String(values[key]))
              : values[key],
          isEnabled: true,
          type: param.type,
        };
        return acc;
      },
      {} as Record<string, unknown>,
    );

    sendOrder([{ id: item.id, fields: fields as Record<string, never> }]);
  };

  const handleParamChange = (key: string, value: string | number | boolean) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  if (!hasParams) {
    return (
      <div className="flex items-center justify-between gap-3 border-b px-4 py-2 last:border-0">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-foreground truncate text-sm font-medium">
            {item.label}
          </span>
          <Badge variant="outline" className="shrink-0 font-mono text-xs">
            {item.id}
          </Badge>
        </div>
        <Button size="sm" variant="outline" onClick={handleSend}>
          <Send className="mr-1 size-3" />
          Send
        </Button>
      </div>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="hover:bg-accent/50 flex w-full items-center justify-between gap-3 border-b px-4 py-2 transition-colors last:border-0">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-foreground truncate text-sm font-medium">
            {item.label}
          </span>
          <Badge variant="outline" className="shrink-0 font-mono text-xs">
            {item.id}
          </Badge>
          <Badge variant="secondary" className="shrink-0 text-xs">
            {Object.keys(item.fields).length} params
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={hasInvalidNumeric}
            onClick={(e) => {
              e.stopPropagation();
              handleSend();
            }}
          >
            <Send className="mr-1 size-3" />
            Send
          </Button>
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
