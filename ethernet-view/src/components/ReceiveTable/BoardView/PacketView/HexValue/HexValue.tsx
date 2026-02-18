import styles from "./HexValue.module.scss";
import { useMemo } from "react";

function getByteArr(hex: string): string[] {
    const byteArr = [] as string[];

    for (let i = 0; i < hex.length - 1; i += 2) {
        byteArr.push(hex[i] + hex[i + 1]);
    }

    if (hex.length % 2 != 0) {
        byteArr.push(hex[hex.length - 1]);
    }

    return byteArr;
}

type Props = {
    hex: string;
};

export const HexValue = ({ hex }: Props) => {
    const byteArr = useMemo(() => getByteArr(hex.toUpperCase()), [hex]);

    return (
        <div className={styles.hexValue}>
            {byteArr.map((byte, index) => {
                return (
                    <span
                        key={index}
                        className={styles.byte}
                    >
                        {byte}
                    </span>
                );
            })}
        </div>
    );
};
