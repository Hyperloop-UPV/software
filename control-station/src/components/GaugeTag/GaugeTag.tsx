import styles from 'components/GaugeTag/GaugeTag.module.scss';
import { Gauge } from 'components/GaugeTag/Gauge/Gauge';
import { TextData } from './TextData/TextData';
import { memo, useContext, useEffect, useRef, useState } from 'react';
import { useGlobalTicker } from 'common';
import { getPercentageFromRange } from 'state';
import { LostConnectionContext } from 'services/connections';

type Props = {
    name: string;
    id: string;
    units: string;
    getUpdate: () => number;
    strokeWidth: number;
    min: number;
    max: number;
};

export const GaugeTag = memo(
    ({ name, units, id, getUpdate, strokeWidth, min, max }: Props) => {
        const [value, setValue] = useState(getUpdate());
        const lostConnection = useContext(LostConnectionContext);
        const percentage = lostConnection
            ? 100
            : getPercentageFromRange(Math.abs(value), min, max);

        useGlobalTicker(() => {
            setValue(getUpdate());
        });

        return (
            <article className={styles.gaugeTagWrapper}>
                <Gauge
                    className={styles.gauge}
                    id={id}
                    sweep={250}
                    strokeWidth={strokeWidth}
                    percentage={percentage}
                />
                <TextData
                    name={name}
                    units={units}
                    value={value}
                    max={max}
                    lostConnection={lostConnection}
                ></TextData>
            </article>
        );
    }
);
