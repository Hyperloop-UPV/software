import { useGlobalTicker } from 'common';
import styles from './BatteryIndicator.module.scss';
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
    getValueSOC: () => number;
    safeRangeMin: number;
    warningRangeMin: number;
    safeRangeMax: number;
    warningRangeMax: number;
    units?: string;
    color?: string;
    backgroundColor?: string;
    className?: string;
}

export const BatteryIndicator = memo(
    ({
        icon,
        getValue,
        getValueSOC,
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
        const [valueStateSOC, setValueStateSOC] = useState<number>(0);
        const lostConnection = useContext(LostConnectionContext);

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
            setValueStateSOC(getValueSOC())
        });

        return (
            <div
                className={`${styles.battery_indicator} ${className}`}
                style={{
                    backgroundColor:
                        backgroundColor != undefined
                            ? backgroundColor
                            : 'transparent',
                }}
            >
                <div className={styles.battery_container}>
                    <div
                        className={styles.battery_fill}
                        style={{
                            height: lostConnection ? 0 : valueStateSOC + '%',
                            color: color != undefined ? color : color,
                        }}
                    />
                    <div className={styles.battery_level_text}>
                        <span className={styles.value}>
                            {lostConnection ? '-.-' : valueState?.toFixed(1)}
                        </span>
                        {units && <span className={styles.units}>{units}</span>}
                    </div>
                </div>

                <div className={styles.info_container}>
                    <div className={styles.name_container}>
                        {icon && <img className={styles.icon} src={icon} />}
                    </div>
                    
                    <div className={styles.percentage_container}>
                        <span className={styles.percentage}>
                            {lostConnection ? '-.--' : valueStateSOC ? valueStateSOC.toFixed(2) : '-.--'}%
                        </span>
                    </div>
                </div>
            </div>
        );
    }
);
