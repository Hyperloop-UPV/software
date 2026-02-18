import styles from "./SendElement.module.scss";
import { ReactComponent as FileIcon } from "assets/svg/binary-file.svg";
import { ReactComponent as Cross } from "assets/svg/cross.svg";

type Props = {
    file: { name: string; size: number };
    onRemove: () => void;
};

export const SendElement = ({ file, onRemove }: Props) => {
    return (
        <div className={styles.sendElementWrapper}>
            <FileIcon className={styles.fileIcon} />
            <div className={styles.fileData}>
                <div className={styles.name}>{file.name}</div>
                <div className={styles.size}>{file.size} B</div>
            </div>
            <Cross
                className={styles.removeBtn}
                onClick={() => onRemove()}
            />
        </div>
    );
};
