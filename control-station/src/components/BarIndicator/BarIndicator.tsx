import { useGlobalTicker } from 'common';
import styles from './BarIndicator.module.scss';
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
    name: string;
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

export const BarIndicator = memo(
    ({
        icon,
        name,
        getValue,
        safeRangeMin,
        warningRangeMin,
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
                  valueState,
                  warningRangeMin,
                  warningRangeMax
              );
        const state = lostConnection
            ? 'fault'
            : getStateFromRange(
                  valueState,
                  safeRangeMin,
                  safeRangeMax,
                  warningRangeMin,
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
                    <p className={styles.name}>{name}</p>
                </div>
                <div className={styles.value_display}>
                    <p className={styles.value}>
                        {lostConnection ? '-.--' : valueState?.toFixed(2)}
                    </p>
                    <p className={styles.units}>{units}</p>
{/*                     <div className={styles.min_max}>
                        <p
                            className={styles.max}
                        >{`max: ${warningRangeMax}`}</p>
                        <p
                            className={styles.min}
                        >{`min: ${warningRangeMin}`}</p>
                    </div> */}
                </div>
            </div>
        );
    }
);
