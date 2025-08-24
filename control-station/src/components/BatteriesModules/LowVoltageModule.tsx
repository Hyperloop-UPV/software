import React, { useState, useContext } from "react";
import styles from "./BatteriesModule.module.scss";
import { useGlobalTicker, useMeasurementsStore, usePodDataStore } from "common";
import { LostConnectionContext } from "services/connections";

interface CellProps {
  value: number;
  min: number;
  max: number;
}

interface TemperatureProps {
  value: number;
  min: number;
  max: number;
  label: string;
}

const LowVoltageModule: React.FC = () => {
  const minThresholdCellVoltage = 3.67;
  const maxThresholdCellVoltage = 4.2;
  const minThresholdTemperature = 0;
  const maxThresholdTemperature = 60;
  const getNumericMeasurementInfo = useMeasurementsStore((state) => state.getNumericMeasurementInfo);
  const podData = usePodDataStore((state) => state.podData);
  const lostConnection = useContext(LostConnectionContext);
  
  const [cellValues, setCellValues] = useState<number[]>(Array(6).fill(0));
  const [temperature1, setTemperature1] = useState<number>(0);
  const [temperature2, setTemperature2] = useState<number>(0);
  const [temperature3, setTemperature3] = useState<number>(0);
  const [temperature4, setTemperature4] = useState<number>(0);
  const [hasReceivedData, setHasReceivedData] = useState(false);

  useGlobalTicker(() => {
    const boardName = 'BMSL';
    const board = podData.boards.find(b => b.name === boardName);
    const hasReceivedPackets = board?.packets.some(packet => packet.count > 0) || false;
    
    if (hasReceivedPackets && !hasReceivedData) {
      setHasReceivedData(true);
    }
    
    setCellValues(
      Array.from({ length: 6 }, (_, i) => {
        const variableName = `BMSL/cell_${i + 1}`;
        return getNumericMeasurementInfo(variableName)?.getUpdate() ?? 0;
      })
    );
    
    setTemperature1(getNumericMeasurementInfo("BMSL/temperature_1")?.getUpdate() ?? 0);
    setTemperature2(getNumericMeasurementInfo("BMSL/temperature_2")?.getUpdate() ?? 0);
    setTemperature3(getNumericMeasurementInfo("BMSL/temperature_3")?.getUpdate() ?? 0);
    setTemperature4(getNumericMeasurementInfo("BMSL/temperature_4")?.getUpdate() ?? 0);
  });

  const getColorFromValue = (value: number, min: number, max: number, showDisconnected: boolean) => {
    if (showDisconnected) return styles.disconnected;
    if (value < min) return styles.yellow;
    if (value > max) return styles.red;
    return styles.green;
  };

  const showDisconnected = lostConnection || !hasReceivedData;

  const Cell: React.FC<CellProps> = ({ value, min, max }) => {
    const colorClass = getColorFromValue(value, min, max, showDisconnected);
    const formattedValue =  Math.max(0, Math.min(9.999, value)).toFixed(3);
    return (
      <div
        className={`${styles.cell} ${colorClass}`}
        title={showDisconnected ? "DISCONNECTED" : `${value.toFixed(3)} V`}
      >
        <span className={styles.cellText}>{formattedValue}{showDisconnected ? "" : "V"}</span>
      </div>
    );
  };

  const TemperatureIndicator: React.FC<TemperatureProps> = ({ value, min, max, label }) => {
    const colorClass = getColorFromValue(value, min, max, showDisconnected);
    const formattedValue = value.toFixed(1);
    return (
      <div className={styles.temperatureIndicator}>
        <span className={styles.temperatureLabel}>{label}</span>
        <div className={`${styles.temperatureValue} ${colorClass}`}>
          <span className={styles.temperatureText}>{formattedValue}{showDisconnected ? "" : "°C"}</span>
        </div>
      </div>
    );
  };
  return (
    <div className={styles.lowVoltageBoxContainer1}>
      <div className={styles.lowVoltageBoxContainer2}>
        <article className={styles.titleDecorationModule}>
          <h2 className={styles.h2Module}>Low Voltage</h2>
        </article>
        
        <div className={styles.flexCells}>
          {cellValues.map((value, index) => (
            <Cell key={index} value={value} min={minThresholdCellVoltage} max={maxThresholdCellVoltage}/>
          ))}
        </div>
        
        <div className={styles.lowVoltageTemperatureContainer}>
          <TemperatureIndicator 
            value={temperature1} 
            min={minThresholdTemperature} 
            max={maxThresholdTemperature} 
            label="T1" 
          />
          <TemperatureIndicator 
            value={temperature2} 
            min={minThresholdTemperature} 
            max={maxThresholdTemperature} 
            label="T2" 
          />
          <TemperatureIndicator 
            value={temperature3} 
            min={minThresholdTemperature} 
            max={maxThresholdTemperature} 
            label="T3" 
          />
          <TemperatureIndicator 
            value={temperature4} 
            min={minThresholdTemperature} 
            max={maxThresholdTemperature} 
            label="T4" 
          />
        </div>
      </div>
    </div>
  );
};

export default LowVoltageModule;
