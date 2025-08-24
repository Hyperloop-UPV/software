import { HvscuMeasurements, useGlobalTicker, useMeasurementsStore, usePodDataStore, getPacket } from 'common';
import styles from './BoolIndicator.module.scss';
import thunderIcon from 'assets/svg/thunder-filled.svg'
import { useContext, useState } from 'react';
import { LostConnectionContext } from 'services/connections';

export const ImdIndicator = () => {
    const getValue = useMeasurementsStore(
        (state) => state.getBooleanMeasurementInfo(HvscuMeasurements.IsImdOk).getUpdate
    );

    const podData = usePodDataStore((state) => state.podData);
    const lostConnection = useContext(LostConnectionContext);

    const [IsImdOk, setVariant] = useState<boolean | null>(true); 

    const hvscuBoard = podData.boards.find(board => board.name === 'HVSCU');
    const hasReceivedData = hvscuBoard?.packets.some(packet => packet.count > 0) || false;

    useGlobalTicker(() => {
        const currentValue = getValue();
        setVariant(currentValue);
    });

    const showDisconnected = lostConnection || !hasReceivedData || IsImdOk === null;

    return (
        <div
            className={styles.state_indicator}
            style={{ backgroundColor: showDisconnected ? '#cccccc' : IsImdOk ? '#ACF293' : '#EF9A87' }}
        >
            <img className={styles.icon} src={thunderIcon} />

            <p className={styles.title}>
                {showDisconnected ? 'DISCONNECTED' : IsImdOk ? 'ISOLATED' : 'ISOLATION FAULT'}
            </p>

            <img className={styles.icon} src={thunderIcon} />
        </div>
    );
};