import { Orientation } from "hooks/useSplit/Orientation";
import styles from "layouts/SplitLayout/Separator/Separator.module.scss";
import { MouseEvent } from "react";

type Props = {
    orientation: Orientation;
    onMouseDown: (ev: MouseEvent) => void;
};

export const Separator = ({ orientation, onMouseDown }: Props) => {
    return (
        <div
            className={styles.wrapper}
            style={{
                cursor:
                    orientation == Orientation.HORIZONTAL
                        ? "e-resize"
                        : "n-resize",
            }}
            onMouseDown={(ev) => {
                onMouseDown(ev);
            }}
        >
            <div className={styles.line}></div>
        </div>
    );
};
