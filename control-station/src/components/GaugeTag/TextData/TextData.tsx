import styles from './TextData.module.scss';
import { memo } from 'react';

type Props = {
    name: string;
    value: number;
    units: string;
    lostConnection: boolean;
    min?: number;
    max: number;
};

export const TextData = memo(
    ({ name, value, units, lostConnection, min, max }: Props) => {
        return (
            <div className={styles.textData}>
                <div className={styles.name}>{name}</div>
                <div className={styles.value}>
                    {lostConnection ? '-.--' : value.toFixed(2)}
                </div>
                <div className={styles.units}>{units}</div>
                <div className={styles.min}>{min && `min: ${min}`}</div>
                <div className={styles.max}>{`max: ${max}`}</div>
            </div>
        );
    }
);
