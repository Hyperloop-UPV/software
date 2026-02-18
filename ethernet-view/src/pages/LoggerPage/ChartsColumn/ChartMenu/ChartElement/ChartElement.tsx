import { ChartId } from "components/ChartMenu/ChartMenu"
import { AiOutlineCloseCircle } from "react-icons/ai"
import styles from "components/ChartMenu/ChartElement/ChartElement.module.scss"
import { ChartCanvas } from "./ChartCanvas";
import { ChartPoint } from "pages/LoggerPage/LogsColumn/LogLoader/LogsProcessor";
import { useState } from "react";
import { MeasurementId, } from "common";
import { ChartLegend } from "./ChartLegend";

interface Props {
    chartId: ChartId;
    initialMeasurementId: MeasurementId
    removeChart: (chartId: ChartId) => void;
    getDataFromLogSession: (measurement: ChartId) => ChartPoint[];
}

export interface MeasurementLogger {
    id: string;
    color: string;
}

export const ChartElement = ({ chartId, initialMeasurementId, removeChart, getDataFromLogSession }: Props) => {

    const [measurementsInChart, setMeasurementsInChart] = useState<MeasurementLogger[]>([{id: initialMeasurementId, color: 'red'}]);

    const addMeasurementToChart = (measurement: MeasurementLogger) => {
        if(!measurementsInChart.some(measurementInChart => measurementInChart.id === measurement.id)) {
            setMeasurementsInChart([...measurementsInChart, measurement]);
        }
    }

    const handleDrop = (ev: React.DragEvent<HTMLDivElement>) => {
        ev.stopPropagation();
        const id = ev.dataTransfer.getData("id");
        addMeasurementToChart({id, color: getRandomColor()});
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
                    getDataFromLogSession={getDataFromLogSession}
                />
                <ChartLegend 
                    chartId={chartId}
                    measurementsInChart={measurementsInChart}
                    removeChart={removeChart}
                    removeMeasurementFromChart={(measurementId: MeasurementId) => setMeasurementsInChart(measurementsInChart.filter(measurement => measurement.id !== measurementId))}
                />
            </div>
        </div>
    )
}

function getRandomColor() {
    var r = Math.floor(Math.random() * 256);
    var g = Math.floor(Math.random() * 256);
    var b = Math.floor(Math.random() * 256);
    var hexR = r.toString(16).padStart(2, '0');
    var hexG = g.toString(16).padStart(2, '0');
    var hexB = b.toString(16).padStart(2, '0');
    return '#' + hexR + hexG + hexB;
  }