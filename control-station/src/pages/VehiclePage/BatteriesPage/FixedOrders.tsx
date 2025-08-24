import { BoardOrders, Order, OrderDescription } from 'common';
import { BigOrderButton } from 'components/BigOrderButton';
import { ReactComponent as BrakeIcon } from '../../../assets/svg/brake-icon.svg';
import { ReactComponent as OpenContactorsIcon } from '../../../assets/svg/open-contactors-icon.svg';
import { ReactComponent as EmergencyStopIcon } from '../../../assets/svg/emergency-stop-icon.svg';
import styles from './FixedOrders.module.scss';

export type Props = {};

export default function FixedOrders(_: Props) {
    return (
        <div className={styles.fixed_orders}>
            <BigOrderButton
                orders={openContactorsOrders}
                label="Open Contactors"
                shortcut="o"
                icon={<OpenContactorsIcon />}
                className={`${styles.emergency_button} ${styles.open_contactors}`}
                brightness={1.3}
            />
            <BigOrderButton
                orders={emergencyStopOrders}
                label="Emergency Stop"
                shortcut=" "
                icon={<EmergencyStopIcon />}
                className={`${styles.emergency_button} ${styles.emergency_stop}`}
                brightness={3}
            />
        </div>
    );
}

export const brakeOrders: Order[] = [
    {
        id: 215,
        fields: {},
    },
];

export const openContactorsOrders: Order[] = [
    {
        id: 902,
        fields: {},
    },
];

export const emergencyStopOrders: Order[] = [
    {
        id: 55,
        fields: {},
    },
    {
        id: 1799,
        fields: {},
    },
    {
        id: 1698,
        fields: {},
    },
    {
        id: 0,
        fields: {},
    },
];

export const desiredOrders = [
    53, 44, 52, 43, 56, 58, 38, 47, 62, 55, 32,
    1799, 1792, 1697, 1698, 1693, 1699
];

export function getHardcodedOrders(boardOrders: BoardOrders[]): BoardOrders[] {
    for (const board of boardOrders) {
        board.orders = board.orders.filter((order) =>
            desiredOrders.includes(order.id)
        );
        board.stateOrders = board.stateOrders.filter((order) =>
            desiredOrders.includes(order.id)
        );
    }

    return boardOrders;
}
