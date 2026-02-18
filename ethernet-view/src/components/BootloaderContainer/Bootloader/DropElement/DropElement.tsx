import styles from "./DropElement.module.scss";
import { useState } from "react";
import { FileInput } from "components/FormComponents/FileInput/FileInput";
import { getFile } from "../getFile";

type Props = {
    onFile: (file: File) => void;
};

export const DropElement = ({ onFile }: Props) => {
    const [isDragOver, setDragOver] = useState(false);

    return (
        <div
            className={`${styles.dropElementWrapper} ${
                isDragOver ? styles.dragOver : ""
            }`}
            //FIXME: drag over is set to false when dragging over Choose File
            onDragEnter={() => {
                setDragOver(true);
            }}
            onDragLeave={(ev) => {
                if (ev.currentTarget.contains(ev.relatedTarget as Node)) {
                    return;
                }
                setDragOver(false);
            }}
            // onDragLeaveCapture={() => setDragOver(false)}
            onDrop={(ev) => {
                const file = getFile(ev, "bin");
                if (file) {
                    onFile(file);
                }
            }}
            onDragOver={(ev) => ev.preventDefault()}
        >
            <div className={styles.textWrapper}>
                <span style={{ pointerEvents: "none" }}>Drop or&nbsp;</span>
                <FileInput
                    accept=".bin"
                    onFile={onFile}
                    className={styles.link}
                    label={"Choose file"}
                />
            </div>
        </div>
    );
};
