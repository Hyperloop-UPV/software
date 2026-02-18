import styles from "./Origin.module.scss";
import { ReactComponent as RightArrow } from "assets/svg/right-arrow.svg";

type Props = {
    board: string;
    name: string;
    className: string;
};

export const Origin = ({ board, name, className }: Props) => {
    return (
        <div className={`${className} ${styles.origin}`}>
            <span className={styles.text}>{board}</span>
            <RightArrow className={styles.arrow} />
            <span
                className={styles.text}
                style={{ textOverflow: "ellipsis", overflow: "hidden" }}
            >
                {name}
            </span>
        </div>
    );
};
