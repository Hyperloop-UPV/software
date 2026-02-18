import { BoardOrders } from "common";
import styles from "./BoardOrders.module.scss";
import { OrderForm } from "./OrderForm/OrderForm";
import { useState } from "react";
import { Caret } from "components/Caret/Caret";

type Props = {
    boardOrders: BoardOrders;
    alwaysShowStateOrders: boolean;
};

export const BoardOrdersView = ({
    boardOrders,
    alwaysShowStateOrders,
}: Props) => {

    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className={styles.boardOrders}>
            <div className={styles.name} onClick={() => setIsOpen((prev) => !prev)} >
                <Caret isOpen={isOpen} />
                {boardOrders.name}
            </div>

            <div className={styles.orders} style={{
                display: isOpen ? "flex" : "none"
            }}>
                <span className={styles.title}>Permanent orders</span>
                {boardOrders.orders.map((desc) => {
                    return (
                        <OrderForm
                            key={desc.id}
                            description={desc}
                        />
                    );
                })}
            </div>
            
            {(boardOrders.stateOrders.length > 0 &&
                (alwaysShowStateOrders || boardOrders.stateOrders.some((item) => item.enabled))) && (
                    <div className={styles.stateOrders}>
                        <span className={styles.title}>State orders</span>
                        {boardOrders.stateOrders.map((desc) => {
                            if (alwaysShowStateOrders || desc.enabled) {
                                return (
                                    <OrderForm
                                        key={desc.id}
                                        description={desc}
                                    />
                                );
                            } else {
                                return false;
                            }
                        })}
                    </div>
                )}
        </div>
    );
};
