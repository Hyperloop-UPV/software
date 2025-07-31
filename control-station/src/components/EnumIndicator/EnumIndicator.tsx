import { useGlobalTicker, useMeasurementsStore, usePodDataStore } from "common";
import styles from "./EnumIndicator.module.scss";
import { memo, useContext, useState } from "react";
import { LostConnectionContext } from "services/connections";

interface Props {
  measurementId: string;
  icon: string;
}

export const EnumIndicator = memo(({ measurementId, icon }: Props) => {
  const getValue = useMeasurementsStore(
    (state) => state.getEnumMeasurementInfo(measurementId).getUpdate,
  );

  const podData = usePodDataStore((state) => state.podData);
  const lostConnection = useContext(LostConnectionContext);

  const [hasReceivedData, setHasReceivedData] = useState(false);
  const [variant, setVariant] = useState(getValue());

  useGlobalTicker(() => {
    const boardName = measurementId.split('/')[0];
    
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
      className={styles.enum_indicator}
      style={{
        backgroundColor:
          enumToColor[state.toUpperCase()] || enumToColor.default,
      }}
    >
      <img className={styles.icon} src={icon} />

      <p className={styles.title}>{showDisconnected ? "DISCONNECTED" : state.toUpperCase()}</p>

      <img className={styles.icon} src={icon} />
    </div>
  );
});

const enumToColor: { [key: string]: string } = {
    'DISCONNECTED': "#cccccc",
    'NOT_CHARGING' : '#EBF6FF',
    'CHARGING' : '#F583F8',
    'CHARGED' : '#FBD15B',

    'OK' : '#ACF293',

    'HV OPEN' : '#83C0F8',
    'HV CLOSED' : '#ACF293',

    'OPEN' : '#83C0F8',
    'PRECHARGE' : '#BB83F8',
    'CLOSED' : '#ACF293',
    'CLOSE' : '#ACF293',

    'OPERATIONAL': '#ACF293',
    'TESTING' : '#83C0F8',
    'BOOSTING' : '#07FCC3',

    'DISENGAGED' : '#FBD15B',
    'ENGAGED' : '#ACF293',
    'FAULT': "#EF9A87",

  default: "#EBF6FF",
};
