import styles from "./Island.module.scss";

type Props = {
    style?: React.CSSProperties;
    children: React.ReactNode;
};

export const Island = ({ children, style }: Props) => {
    return (
        <div
            className={styles.island}
            style={style}
        >
            {children}
        </div>
    );
};
