import styles from './Orders.module.scss';
import { BoardOrders, Button } from 'common';
import { OrderContext } from './OrderContext';
import { useSendOrder } from '../useSendOrder';
import { BoardOrdersView } from './BoardOrders/BoardOrders';
import { useState } from 'react';

type Props = {
    boards: BoardOrders[];
};

export const Orders = ({ boards }: Props) => {
    const sendOrder = useSendOrder();
    const [alwaysShowStateOrders, setAlwaysShowStateOrders] = useState(false);

    return (
        <OrderContext.Provider value={sendOrder}>
            <div className={styles.ordersWrapper}>
                <div className={styles.stateOrdersToggle}>
                    Always show state orders:{' '}
                    <Button
                        key={alwaysShowStateOrders ? 'true' : 'false'}
                        className={styles.stateOrdersToggleButton}
                        color={alwaysShowStateOrders ? '#008000' : '#f3785c'}
                        label={alwaysShowStateOrders ? 'True' : 'False'}
                        onClick={() =>
                            setAlwaysShowStateOrders((prev) => !prev)
                        }
                    />
                </div>
                <div className={styles.boardOrderList}>
                    {boards.map((board) => {
                        return (
                            (board.orders.length > 0 ||
                                board.stateOrders.length > 0) && (
                                <BoardOrdersView
                                    key={board.name}
                                    boardOrders={board}
                                    alwaysShowStateOrders={
                                        alwaysShowStateOrders
                                    }
                                />
                            )
                        );
                    })}
                </div>
            </div>
        </OrderContext.Provider>
    );
};
