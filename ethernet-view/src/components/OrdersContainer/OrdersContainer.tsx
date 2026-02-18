import styles from "./OrdersContainer.module.scss";
import { Orders } from "./Orders/Orders";
import { useConfig, useFetchBack } from "common";
import { useEffect } from "react";
import { useOrders } from "common";
import { useOrdersStore } from "common";

export const OrdersContainer = () => {
    const config = useConfig();
    const setOrders = useOrdersStore((state) => state.setOrders);

    const orderDescriptionPromise = useFetchBack(
        import.meta.env.PROD,
        config.paths.orderDescription
    );
    useEffect(() => {
        orderDescriptionPromise.then((desc) => setOrders(desc));
    }, []);

    const orders = useOrders();

    return (
        <div className={styles.orderTableWrapper}>
            {orders.length == 0 ? (
                <span className={styles.emptyAlert}>
                    Orders added to ADE will appear here
                </span>
            ) : (
                <Orders boards={orders} />
            )}
        </div>
    );
};
