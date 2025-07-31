import styles from "./OrdersContainer.module.scss";
import { Orders } from "./Orders/Orders";
import { useConfig, useFetchBack, BoardOrders } from "common";
import { useEffect } from "react";
import { useOrders } from "common";
import { useOrdersStore } from "common";

interface Props {
    boardFilter?: string[];
    boardOrdersFilter?: (boardOrders: BoardOrders[]) => BoardOrders[];
}

export const OrdersContainer = ({ boardFilter, boardOrdersFilter }: Props) => {
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

    let filteredOrders = orders;

    if (boardFilter) {
        filteredOrders = filteredOrders.filter(board => boardFilter.includes(board.name));
    }
    if (boardOrdersFilter) {
        filteredOrders = boardOrdersFilter(filteredOrders);
    }

    return (
        <div className={styles.orderTableWrapper}>
            {filteredOrders.length == 0 ? (
                <span className={styles.emptyAlert}>
                    Orders added to ADJ will appear here
                </span>
            ) : (
                <Orders boards={filteredOrders} />
            )}
        </div>
    );
};
