import styles from "./ChartElement.module.scss";
import { AiOutlineCloseCircle } from 'react-icons/ai'
import { MeasurementId, NumericMeasurementInfo, useMeasurementsStore } from 'common';
import { ChartCanvas } from './ChartCanvas/ChartCanvas';
import { ChartLegend } from './ChartLegend/ChartLegend';
import { memo, useCallback, useState } from "react";
import { ChartId } from "../ChartMenu";

type Props = {
    chartId: ChartId;
    initialMeasurementId: MeasurementId;
    removeChart: (chartId: ChartId) => void;
};

// React component that keeps the chart render and measurements represented on it.
export const ChartElement = memo(({ chartId, initialMeasurementId, removeChart }: Props) => {

    const getNumericMeasurementInfo = useMeasurementsStore(state => state.getNumericMeasurementInfo);
    const initialMeasurement = getNumericMeasurementInfo(initialMeasurementId);
    
    const [measurementsInChart, setMeasurementsInChart] = useState([initialMeasurement]);

    const addMeasurementToChart = (measurement: NumericMeasurementInfo) => {
        if(!measurementsInChart.some(measurementInChart => measurementInChart.id === measurement.id)) {
            setMeasurementsInChart([...measurementsInChart, measurement]);
        }
    }

    const removeMeasurementFromChart = useCallback((measurementId: MeasurementId) => {
        setMeasurementsInChart(prevMeasurements => prevMeasurements.filter(measurement => measurement.id !== measurementId));
    }, []);

    const handleDrop = (ev: React.DragEvent<HTMLDivElement>) => {
        ev.stopPropagation();
        const id = ev.dataTransfer.getData("id");
        const measurementInfo = getNumericMeasurementInfo(id);
        addMeasurementToChart(measurementInfo);
    };

    return (
        <div
            className={styles.chartWrapper}
            onDrop={handleDrop}
            onDragEnter={(ev) => ev.preventDefault()}
            onDragOver={(ev) => ev.preventDefault()}
        >   
            <div className={styles.chart}>
                <AiOutlineCloseCircle
                    size={30}
                    cursor="pointer"
                    onClick={() => removeChart(chartId)}
                />
                <ChartCanvas
                    measurementsInChart={measurementsInChart}
                />
                <ChartLegend
                    chartId={chartId}
                    measurementsInChart={measurementsInChart}
                    removeMeasurementFromChart={removeMeasurementFromChart}
                    removeChart={removeChart}
                />
            </div>
        </div>
    );
});
