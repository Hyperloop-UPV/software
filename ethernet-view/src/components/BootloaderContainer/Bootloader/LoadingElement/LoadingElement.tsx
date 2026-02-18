import styles from "./LoadingElement.module.scss";
import { ProgressBar } from "components/ProgressBar/ProgressBar";

type Props = {
    progress: number;
};

export const LoadingElement = ({ progress }: Props) => {
    return (
        <div className={styles.awaitElementWrapper}>
            Loading
            <ProgressBar progress={progress} />
        </div>
    );
};
