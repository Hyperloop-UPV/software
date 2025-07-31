import { HvscuCabinetMeasurements, useGlobalTicker, useMeasurementsStore, usePodDataStore } from 'common';
import styles from './BoolIndicator.module.scss';
import thunderIcon from 'assets/svg/thunder-filled.svg'
import { useContext, useState } from 'react';
import { LostConnectionContext } from 'services/connections';

export const SdcIndicator = () => {
    const getValue = useMeasurementsStore(
        (state) => state.getEnumMeasurementInfo(HvscuCabinetMeasurements.SDC).getUpdate
    );

    const podData = usePodDataStore((state) => state.podData);
    const lostConnection = useContext(LostConnectionContext);

    const [hasReceivedData, setHasReceivedData] = useState(false);
    const [variant, setVariant] = useState(getValue());

    useGlobalTicker(() => {
        const boardName = HvscuCabinetMeasurements.SDC.split('/')[0];
        
        const board = podData.boards.find(b => b.name === boardName);
        const hasReceivedPackets = board?.packets.some(packet => packet.count > 0) || false;
        
        const currentValue = getValue();
        setVariant(currentValue);

        if (hasReceivedPackets && !hasReceivedData) {
            setHasReceivedData(true);
        }
    });

    const showDisconnected = lostConnection || !hasReceivedData;
    const state = showDisconnected ? "DISCONNECTED" : variant;

    return (
        <div
            className={styles.state_indicator}
            style={{
                backgroundColor: enumToColor[state.toUpperCase()] || enumToColor.default
            }}
        >
            <img className={styles.icon} src={thunderIcon} />

            <p className={styles.title}>
                {showDisconnected ? 'DISCONNECTED' : enumToText[state.toUpperCase()] || state.toUpperCase()}
            </p>

            <img className={styles.icon} src={thunderIcon} />
        </div>
    );
};

const enumToColor: { [key: string]: string } = {
    'DISCONNECTED': '#cccccc',
    'TRUE': '#ACF293',
    'FALSE': '#FBD15B',
    default: '#EBF6FF'
};

const enumToText: { [key: string]: string } = {
    'TRUE': 'ENGAGED',
    'FALSE': 'DISENGAGED'
};