import { MeasurementId } from "common";
import { ChartId } from "components/ChartMenu/ChartMenu";
import { useEffect, useRef } from "react";
import styles from "components/ChartMenu/ChartElement/ChartLegend/ChartLegend.module.scss"
import { MeasurementLogger } from "./ChartElement";

interface Props {
    chartId: ChartId;
    measurementsInChart: MeasurementLogger[];
    removeMeasurementFromChart: (measurementId: MeasurementId) => void;
    removeChart: (chartId: ChartId) => void;
}

export const ChartLegend = ({ chartId, measurementsInChart, removeMeasurementFromChart, removeChart }: Props) => {

    const legendRef = useRef<HTMLDivElement>(null);
    
    const onRemoveMeasurement = (measurementId: MeasurementId) => {
        removeMeasurementFromChart(measurementId);
    };

    useEffect(() => {
        if(measurementsInChart.length == 0) removeChart(chartId);
    }, [measurementsInChart.length])

    useEffect(() => {
        if (legendRef.current) {
            while (legendRef.current.firstChild) {
                legendRef.current.removeChild(legendRef.current.firstChild);
            }
            measurementsInChart.forEach((measurement) => {
                const newChartLegendItem = createChartLegendItem(measurement);
                newChartLegendItem.onclick = (_) => onRemoveMeasurement(measurement.id);
                legendRef.current?.appendChild(newChartLegendItem);
            });
        }
    });

    return <div className={styles.chartLegend} ref={legendRef}></div>;
};

function createChartLegendItem(measurement: MeasurementLogger) {
    const legendItem = document.createElement("div");
    legendItem.setAttribute("data-id", measurement.id);
    legendItem.className = styles.chartLegendItem;
    const seriesColor = document.createElement("div");
    seriesColor.className = styles.chartLegendItemColor;
    seriesColor.style.backgroundColor = measurement.color;
    const seriesName = document.createElement("p");
    seriesName.innerText = measurement.id;
    legendItem.appendChild(seriesColor);
    legendItem.appendChild(seriesName);
    return legendItem;
}
