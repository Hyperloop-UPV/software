import styles from "components/ChartMenu/ChartMenu.module.scss";
import { DragEvent, memo, useCallback, useState, useEffect } from "react";
import Sidebar from "components/ChartMenu/Sidebar/Sidebar";
import { Section } from "./Sidebar/Section/Section";
import { MeasurementId, useMeasurementsStore } from "common";
import { nanoid } from "nanoid";
import { ChartElement } from "./ChartElement/ChartElement";

export type ChartId = string;

export type ChartInfo = {
    chartId: ChartId;
    initialMeasurementId: MeasurementId;
};

type Props = {
    sidebarSections: Section[];
};

export const ChartMenu = memo(({ sidebarSections }: Props) => {

    const getNumericMeasurementInfo = useMeasurementsStore((state) => state.getNumericMeasurementInfo);

    const [charts, setCharts] = useState<ChartInfo[]>([]);
    const [sidebarVisible, setSidebarVisible] = useState<boolean>(true);

    const addChart = ((chartId: ChartId, initialMeasurementId: MeasurementId) => {
        setCharts([...charts, { chartId, initialMeasurementId }]);
    });

    const removeChart = useCallback((chartId: ChartId) => {
        setCharts(prevCharts => prevCharts.filter(chart => chart.chartId !== chartId));
    }, []);
    
    const handleDrop = (ev: DragEvent<HTMLDivElement>) => {
        ev.preventDefault();
        const id = ev.dataTransfer.getData("id");
        const initialMeasurementId = getNumericMeasurementInfo(id).id;
        addChart(nanoid(), initialMeasurementId);
    };

    const toggleSidebar = () => {
        setSidebarVisible(!sidebarVisible);
    };

    // Trigger resize event when sidebar visibility changes to help charts adjust
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            window.dispatchEvent(new Event('resize'));
        }, 350); // Wait for CSS transition to complete

        return () => clearTimeout(timeoutId);
    }, [sidebarVisible]);

    if (sidebarSections.length == 0) {
        return (
            <div className={styles.noValues}>
                No available values to chart. This might happen if none of the
                measurements are numeric (only numeric measurements are
                chartable).
            </div>
        );
    } else {
        return (
            <div className={`${styles.chartMenuWrapper} ${!sidebarVisible ? styles.sidebarHidden : ''}`}>
                {sidebarVisible && <Sidebar sections={sidebarSections} />}
                <div className={styles.chartContentWrapper}>
                    <button 
                        className={styles.toggleButton}
                        onClick={toggleSidebar}
                        title={sidebarVisible ? "Hide sidebar" : "Show sidebar"}
                    >
                        {sidebarVisible ? "◀" : "▶"}
                    </button>
                    <div
                        className={styles.chartListWrapper}
                        onDrop={handleDrop}
                        onDragEnter={(ev) => ev.preventDefault()}
                        onDragOver={(ev) => ev.preventDefault()}
                    >
                        {charts.map((chart) => (
                            <ChartElement
                                key={chart.chartId}
                                chartId={chart.chartId}
                                initialMeasurementId={chart.initialMeasurementId}
                                removeChart={removeChart}
                            />
                        ))}
                    </div>
                </div>
            </div>
        );
    }
});

