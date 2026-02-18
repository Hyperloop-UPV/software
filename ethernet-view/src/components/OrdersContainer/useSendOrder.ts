import { Order, useWsHandler } from "common";

export function useSendOrder() {
    const handler = useWsHandler();

    return (order: Order) => {
        handler.post("order/send", order);
    };
}
