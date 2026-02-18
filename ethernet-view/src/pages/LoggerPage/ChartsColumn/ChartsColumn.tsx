import { TabLayout } from "layouts/TabLayout/TabLayout";
import { ChartMenu } from "./ChartMenu/ChartMenu";
import { ReactComponent as Chart } from "assets/svg/chart.svg";

export const ChartsColumn = () => {
    const chartsColumnTabItems = [
            {
                id: "charts",
                name: "Charts",
                icon: <Chart />,
                component: <ChartMenu />,
            },
        ]

    return <TabLayout tabs={chartsColumnTabItems}></TabLayout>;
};