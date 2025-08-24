import { VcuMeasurements, useGlobalTicker, useMeasurementsStore, usePodDataStore } from "common";
import { useContext, useState } from "react";
import { LostConnectionContext } from "services/connections";
import styles from '../MainPage.module.scss';

export const BrakeState = () => {
    const getValue = useMeasurementsStore(
            (state) => state.getBooleanMeasurementInfo(VcuMeasurements.allReeds).getUpdate
        );
    
    const podData = usePodDataStore((state) => state.podData);
    const lostConnection = useContext(LostConnectionContext);

    const [ReedsState, setVariant] = useState(false);

    const vcuBoard = podData.boards.find(board => board.name === 'VCU');
    const hasReceivedData = vcuBoard?.packets.some(packet => packet.count > 0) || false;

    useGlobalTicker(() => {
        const currentValue = getValue();
        setVariant(currentValue);
    });

    const showDisconnected = lostConnection || !hasReceivedData;

    return (
        <div className={styles.break_state} style={{ backgroundColor: showDisconnected ? '#cccccc' : ReedsState ? '#f3785c' : '#99ccff' }}>
            <div style={{ color: showDisconnected ? '#888888' : ReedsState ? '#571500' : '#0059b3' }}>
                {showDisconnected ? 'DISCONNECTED' : ReedsState ? 'BRAKED' : 'UNBRAKED'}
            </div>
        </div>
    );
}