import styles from "./ProgressBar.module.scss";

type Props = {
    progress: number; // Between 0 and 100
};

export const ProgressBar = ({ progress }: Props) => {
    return (
        <div className={styles.progressBar}>
            <div
                className={styles.fill}
                style={{ flexBasis: `${progress}%` }}
            ></div>
        </div>
    );
};
