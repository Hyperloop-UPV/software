import styles from "./Header.module.scss";
import { TabBar } from "./TabBar/TabBar";
import { TabItem } from "layouts/TabLayout/TabItem";

type Props = {
    tabs: TabItem[];
    visibleTab: TabItem;
    onTabClick: (tab: TabItem) => void;
};

export const Header = ({ tabs, visibleTab, onTabClick }: Props) => {
    return (
        <div className={styles.headerWrapper}>
            <div className={styles.name}>{visibleTab.name}</div>
            {tabs.length > 1 && (
                <TabBar
                    tabs={tabs}
                    onTabClick={onTabClick}
                    visibleTabId={visibleTab.id}
                />
            )}
        </div>
    );
};
