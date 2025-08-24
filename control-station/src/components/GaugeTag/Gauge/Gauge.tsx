import { clampAndNormalize } from 'math';
import { Arc } from './Arc/Arc';
import { BackgroundArc } from './BackgroundArc/BackgroundArc';
import styles from 'components/GaugeTag/Gauge/Gauge.module.scss';

type Props = {
    className: string;
    id: string;
    sweep: number;
    strokeWidth: number;
    percentage: number;
};

export const Gauge = ({
    className,
    id,
    sweep,
    strokeWidth,
    percentage,
}: Props) => {
    const radius = 500;
    return (
        <svg
            className={className}
            width="1em"
            height="1em"
            viewBox={`0 0 ${radius * 2} ${radius * 2}`}
        >
            <Arc
                className={styles.backgroundArc}
                sweep={sweep}
                radius={radius}
                strokeWidth={strokeWidth}
                percentage={100}
            ></Arc>

            <BackgroundArc
                sweep={sweep}
                className={styles.rainbowArc}
                id={id}
                percentage={percentage}
                radius={radius}
                strokeWidth={strokeWidth}
            ></BackgroundArc>
        </svg>
    );
};