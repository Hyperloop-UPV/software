import styles from "./TabBar.module.scss";
import { Tab } from "./Tab/Tab";
import { TabItem } from "layouts/TabLayout/TabItem";

type Props = {
    tabs: TabItem[];
    onTabClick: (tab: TabItem) => void;
    visibleTabId: string;
};

export const TabBar = ({ tabs, onTabClick, visibleTabId }: Props) => {
    return (
        <div className={styles.wrapper}>
            {tabs.map((tab) => {
                return (
                    <Tab
                        key={tab.id}
                        className={tab.id == visibleTabId ? styles.active : ""}
                        name={tab.name}
                        icon={tab.icon}
                        onClick={() => onTabClick(tab)}
                    ></Tab>
                );
            })}
        </div>
    );
};
