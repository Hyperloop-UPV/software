import { logger, socketService } from "@workspace/core";
import { useCallback } from "react";
import type { Order } from "../constants/orders";

/**
 * Returns a stable callback that posts one or more orders to the backend
 * via the `order/send` WebSocket topic.
 *
 * Each order is dispatched independently in the given sequence.
 * The caller is responsible for providing valid order IDs.
 */
const useSendOrder = () =>
  useCallback((orders: Order[]) => {
    for (const order of orders) {
      logger.competitionView.log("Sending order:", order.id);
      socketService.post("order/send", order);
    }
  }, []);

export default useSendOrder;
