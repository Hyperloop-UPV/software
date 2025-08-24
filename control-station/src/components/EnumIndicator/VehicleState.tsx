import { useGlobalTicker, useMeasurementsStore, VcuMeasurements, usePodDataStore } from 'common';
import styles from './EnumIndicator.module.scss';
import { useContext, useState } from 'react';
import { LostConnectionContext } from 'services/connections';
import teamLogo from 'assets/svg/team_logo.svg'

export const VehicleState = () => {
    const generalStateMeasurement = useMeasurementsStore(
        (state) => state.getEnumMeasurementInfo(VcuMeasurements.generalState).getUpdate
    );
    const operationalStateMeasurement = useMeasurementsStore(
        (state) => state.getEnumMeasurementInfo(VcuMeasurements.operationalState).getUpdate
    );

    const podData = usePodDataStore((state) => state.podData);
    const lostConnection = useContext(LostConnectionContext);

    const [generalState, setGeneralState] = useState('FAULT');
    const [operationalState, setOperationalState] = useState('FAULT');

    const vcuBoard = podData.boards.find(board => board.name === 'VCU');
    const hasReceivedData = vcuBoard?.packets.some(packet => packet.count > 0) || false;

    useGlobalTicker(() => {
        const currentGeneralState = generalStateMeasurement();
        const currentOperationalState = operationalStateMeasurement();
        setGeneralState(currentGeneralState);
        setOperationalState(currentOperationalState);
    });

    const showDisconnected = lostConnection || !hasReceivedData;
    
    const state = showDisconnected
        ? 'DISCONNECTED'
        : (generalState == 'OPERATIONAL') ? operationalState : generalState;

    return (
        <div
            className={styles.enum_indicator}
            style={{ backgroundColor: enumToColor[state] || enumToColor.default }}
        >
            <img className={styles.icon} src={teamLogo} />

            <p className={styles.title}>
                {enumToText[state] ?? state}
            </p>

            <img className={styles.icon} src={teamLogo} />
        </div>
    );
}

const enumToColor: { [key: string]: string } = {
    'DISCONNECTED' : '#cccccc',
    "FAULT" : '#EF9A87',
    "END_OF_RUN" : '#BB83F8',
    "ENERGIZED" : '#FBD15B',
    "READY" : '#B2CFD6',
    "DEMONSTRATION" : '#ACF293',
    default : '#EBF6FF'

}

const enumToText: { [key:string]: string } = {
    'FAULT' : 'EMERGENCY',
    "END_OF_RUN" : 'END OF RUN'
}
