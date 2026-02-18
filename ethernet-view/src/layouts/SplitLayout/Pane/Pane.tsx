import styles from "layouts/SplitLayout/Pane/Pane.module.scss";

type Props = {
    component: React.ReactNode;
    normalizedLength: number;
    collapsedIcon: string;
};

export const Pane = ({ component, normalizedLength, collapsedIcon }: Props) => {

    const isCollapsed = normalizedLength === 0;
    
    return (
        <div
            className={isCollapsed ? styles.collapsed : styles.wrapper}
            style={{
                flex: normalizedLength,
            }}
        >
            <div className={styles.icon} style={{
                display: isCollapsed ? "block" : "none"
            }}>
                <img src={collapsedIcon} alt="collapsed" />
            </div>

            <div style={isCollapsed ? {display: "none"} : {height: "100%"}}>
                {component}
            </div>
            
        </div>
    );
};
