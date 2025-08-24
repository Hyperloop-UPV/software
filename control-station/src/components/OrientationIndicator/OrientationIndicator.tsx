import { useGlobalTicker } from 'common';
import styles from './OrientationIndicator.module.scss';
import { memo, useContext, useState } from 'react';
import { LostConnectionContext } from 'services/connections';

interface Props {
    icon?: string;
    name: string;
    getValue: () => number;
    units?: string;
    color?: string;
    backgroundColor?: string;
    className?: string;
}

export const OrientationIndicator = memo(
    ({
        icon,
        name,
        getValue,
        units,
        className,
    }: Props) => {
        const [valueState, setValueState] = useState<number>(0);
        const lostConnection = useContext(LostConnectionContext);

        useGlobalTicker(() => {
            setValueState(getValue());
        });

        return (
            <div
                className={`${styles.bar_indicator} ${className}`}
            >
                <div className={styles.name_display}>
                    <img className={styles.icon} src={icon} />
                    <p className={styles.name}>{name}</p>
                </div>
                <div className={styles.value_display}>
                    <p className={styles.value}>
                        {lostConnection ? '-.--' : valueState?.toFixed(2)}
                    </p>
                    <p className={styles.units}>{units}</p>
                </div>
            </div>
        );
    }
);
