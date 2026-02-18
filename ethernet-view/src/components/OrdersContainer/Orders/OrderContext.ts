import { Order } from "common";
import { createContext } from "react";

export const OrderContext = createContext<(order: Order) => void>(() => {});
