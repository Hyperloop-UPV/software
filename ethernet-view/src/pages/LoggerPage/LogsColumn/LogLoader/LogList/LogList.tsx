import { LogItem } from "./LogItem/LogItem";
import styles from "./LogList.module.scss"

interface Props {
    logNames: string[];
}

export const LogList = ({logNames}: Props) => {
    return (
        <div className={styles.logListWrapper}>
            {logNames.map((logName) => (
                <LogItem key={logName} logName={logName} />
            ))}
        </div>
    )
}
