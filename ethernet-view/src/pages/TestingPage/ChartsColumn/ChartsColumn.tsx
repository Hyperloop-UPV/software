import { TabLayout } from "layouts/TabLayout/TabLayout";
import { ChartMenu } from "components/ChartMenu/ChartMenu";
import { ReactComponent as Chart } from "assets/svg/chart.svg";
import { useMemo } from "react";
import { useMeasurementsStore, usePodDataStore, useSubscribe } from "common";
import { createSidebarSections } from "components/ChartMenu/sidebar";

export const ChartsColumn = () => {
    const podData = usePodDataStore(state => state.podData);
    const updatePodData = usePodDataStore(state => state.updatePodData)
    const updateMeasurements = useMeasurementsStore(state => state.updateMeasurements)

    useSubscribe("podData/update", (update) => {
        updatePodData(update);
        updateMeasurements(update);
    });

    const sections = useMemo(() => {
        return createSidebarSections(podData);
    }, []);

    const chartsColumnTabItems = [
        {
            id: "charts",
            name: "Charts",
            icon: <Chart />,
            component: <ChartMenu sidebarSections={sections} />,
        },
    ];

    return <TabLayout tabs={chartsColumnTabItems}></TabLayout>;
};