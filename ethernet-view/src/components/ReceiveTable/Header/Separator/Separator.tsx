import styles from "./Separator.module.scss";
import { MouseEvent } from "react";

type Props = {
    onMouseDown: (ev: MouseEvent) => void;
};

export const Separator = ({ onMouseDown }: Props) => {
    return (
        <div
            className={styles.separator}
            onMouseDown={onMouseDown}
        >
            <div className={styles.line}></div>
        </div>
    );
};
