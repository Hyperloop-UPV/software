import { ChartsColumn } from "pages/LoggerPage/ChartsColumn/ChartsColumn";
import { LogsColumn } from "./LogsColumn/LogsColumn";
import { SplitLayout } from "layouts/SplitLayout/SplitLayout";
import logs from "assets/svg/logs.svg";
import chart from "assets/svg/chart.svg";

export const LoggerPage = () => {
    return (
        <SplitLayout 
            components={[
                {
                    component: <LogsColumn />,
                    collapsedIcon: logs
                },
                {
                    component: <ChartsColumn />,
                    collapsedIcon: chart
                }
            ]}
            initialLengths={[0.3, 0.7]}
        />
    );
};
