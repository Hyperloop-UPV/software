import { Dropzone } from "./Dropzone/Dropzone"
import styles from "./LogLoader.module.scss"
import { LogList } from "./LogList/LogList";
import { useLogStore } from "pages/LoggerPage/useLogStore";

export enum UploadState {
    IDLE = "idle",
    UPLOADING = "uploading",
    SUCCESS = "success",
    ERROR = "error",
}

export interface UploadInformation {
    state: UploadState;
    errorMessage?: string;
}

export const LogLoader = () => {

    const logSessions = useLogStore(state => state.logSessions);

    return (
        <div className={styles.logLoaderWrapper}>

            <LogList logNames={logSessions.map((logSession) => logSession.name)} />

            <Dropzone />

        </div>
    )
}
