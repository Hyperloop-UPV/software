import styles from "layouts/TabLayout/TabLayout.module.scss";
import { TabItem } from "layouts/TabLayout/TabItem";
import { Header } from "layouts/TabLayout/Header/Header";
import { Island } from "components/Island/Island";
import { useState } from "react";
type Props = {
    tabs: TabItem[];
};

export const TabLayout = ({ tabs }: Props) => {
    const [visibleTab, setVisibleTab] = useState(tabs[0]);

    function onTabClick(tab: TabItem) {
        setVisibleTab(tab);
    }

    return (
        <Island>
            <Header
                tabs={tabs}
                visibleTab={visibleTab}
                onTabClick={onTabClick}
            />
            <div className={styles.body}>
                <div className={styles.componentWrapper}>
                    {tabs.map((tab) => {
                        return (
                            <div
                                key={tab.id}
                                className={styles.visibilityWrapper}
                                style={{
                                    display:
                                        visibleTab.id == tab.id
                                            ? "flex"
                                            : "none",
                                }}
                            >
                                {tab.component}
                            </div>
                        );
                    })}
                </div>
            </div>
        </Island>
    );
};
