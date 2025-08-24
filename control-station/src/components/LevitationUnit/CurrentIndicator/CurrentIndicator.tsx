import { useGlobalTicker } from 'common';
import styles from './CurrentIndicator.module.scss';
import {
    getPercentageFromRange,
    getStateFromRange,
    stateToColor,
    stateToColorBackground,
} from 'state';
import { memo, useContext, useEffect, useRef, useState } from 'react';
import { LostConnectionContext } from 'services/connections';

interface Props {
    icon?: string;
    getValue: () => number;
    safeRangeMin: number;
    warningRangeMin: number;
    safeRangeMax: number;
    warningRangeMax: number;
    units?: string;
    color?: string;
    backgroundColor?: string;
    className?: string;
}

export const CurrentIndicator = memo(
    ({
        icon,
        getValue,
        safeRangeMax,
        warningRangeMax,
        units,
        color,
        backgroundColor,
        className,
    }: Props) => {
        const [valueState, setValueState] = useState<number>(0);
        const lostConnection = useContext(LostConnectionContext);

        const percentage = lostConnection
            ? 100
            : getPercentageFromRange(
                  Math.abs(valueState),
                  0,
                  warningRangeMax
              );
        const state = lostConnection
            ? 'fault'
            : getStateFromRange(
                  Math.abs(valueState),
                  0,
                  safeRangeMax,
                  0,
                  warningRangeMax
              );

        useGlobalTicker(() => {
            setValueState(getValue());
        });

        return (
            <div
                className={`${styles.bar_indicator} ${className}`}
                style={{
                    backgroundColor:
                        backgroundColor != undefined
                            ? backgroundColor
                            : stateToColorBackground[state],
                }}
            >
                <div
                    className={styles.range_bar}
                    style={{
                        width: percentage + '%',
                        color: color != undefined ? color : stateToColor[state],
                    }}
                />

                <div className={styles.name_display}>
                    <img className={styles.icon} src={icon} />
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
