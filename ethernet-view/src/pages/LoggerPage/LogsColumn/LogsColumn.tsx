import { TabItem } from "layouts/TabLayout/TabItem";
import { TabLayout } from "layouts/TabLayout/TabLayout"
import { LogLoader } from "./LogLoader/LogLoader";

export const LogsColumn = () => {

    const logsColumnTabItems : TabItem[] = [
        {
            id: "logs",
            name: "Logs",
            icon: null,
            component: <LogLoader />
        }
    ];

    return <TabLayout tabs={logsColumnTabItems}/>
}
