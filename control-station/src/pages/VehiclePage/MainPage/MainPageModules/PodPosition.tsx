import { PcuMeasurements, useGlobalTicker, useMeasurementsStore } from "common";
import { useContext, useState } from "react";
import { LostConnectionContext } from "services/connections";
import levion from 'assets/svg/levion.svg'
import styles from '../MainPage.module.scss';
import { getPercentageFromRange } from "state";

export const PodPosition = () => {
    const getNumericMeasurementInfo = useMeasurementsStore((state) => state.getNumericMeasurementInfo);
    const lostConnection = useContext(LostConnectionContext);
    const position = getNumericMeasurementInfo(
        PcuMeasurements.podPosition
    );

    const [positionValue, setValueState] = useState<number>(0);
    useGlobalTicker(() => {
        setValueState(position.getUpdate);
    });

    const percent = getPercentageFromRange(positionValue, 0, 53.4);

    return (
        <div
            className={styles.pod}
            style={{
                backgroundColor: lostConnection ? '#cccccc' : '#99ccff',
                borderRadius: '10rem'
            }}
        >
            <img
                src={levion}
                alt="Pod"
                style={{
                    position: 'absolute',
                    top: '50%',
                    left: `${percent}%`,
                    transform: 'translate(-1%, -51%)',
                    height: '100%',
                    width: 'auto',
                    borderRadius: '1rem',
                    transition: 'left 0.2s',
                    objectFit: 'contain',
                    
                    filter: lostConnection ? 'grayscale(100%)' : 'none',
                }}
            />
        </div>
    );
}