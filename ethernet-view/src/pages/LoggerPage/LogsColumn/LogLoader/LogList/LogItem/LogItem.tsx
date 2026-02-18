import { useLogStore } from "pages/LoggerPage/useLogStore";
import styles from "./LogItem.module.scss"
import folderClosed from "assets/svg/folder-closed.svg"
import folderOpen from "assets/svg/folder-open.svg"
import cross from "assets/svg/cross.svg"

interface Props {
    logName: string;
}

export const LogItem = ({logName}: Props) => {

    const openLogSession = useLogStore(state => state.openLogSession);
    const setOpenLogSession = useLogStore(state => state.setOpenLogSession);
    const removeLogSession = useLogStore(state => state.removeLogSession);
    const isOpen = openLogSession === logName;

    const handleRemoveLog = () => {
        removeLogSession(logName);
    }

    return (
        <div className={styles.logItemWrapper} onClick={() => setOpenLogSession(logName)}>
            <div className={styles.icon}>
                <img src={`${isOpen ? folderOpen : folderClosed}`} alt="log-icon" />
            </div>
            <div className={`${styles.title} ${isOpen ? styles.active : ""}`}>
                {logName}
            </div>
            <div className={styles.icon} onClick={handleRemoveLog}>
                <img src={cross} alt="Remove log" />
            </div>
        </div>
    )
}
