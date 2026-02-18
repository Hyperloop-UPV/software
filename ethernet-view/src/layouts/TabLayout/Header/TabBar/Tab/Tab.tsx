import styles from "./Tab.module.scss";

type Props = {
    name: string;
    className?: string;
    icon?: React.ReactNode;
    onClick: () => void;
};
export const Tab = ({ name, icon, onClick, className = "" }: Props) => {
    return (
        <div
            className={`${styles.wrapper} ${className}`}
            onClick={onClick}
        >
            {icon}
            <div className={styles.name}>{name}</div>
        </div>
    );
};
