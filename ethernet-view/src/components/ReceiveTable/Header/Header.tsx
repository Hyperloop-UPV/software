import styles from "./Header.module.scss";
import { useSplit } from "hooks/useSplit/useSplit";
import { Orientation } from "hooks/useSplit/Orientation";
import { Separator } from "./Separator/Separator";
import { useEffect } from "react";
import { useColumnsStore } from "store/columnsStore";

type Props = {
    items: string[];
};

const MINIMUM_ITEM_SIZE = 0.05;

export const Header = ({ items }: Props) => {
    const columnSizes = useColumnsStore((state) => state.columnSizes);
    const setColumnSizes = useColumnsStore((state) => state.setColumnSizes);

    const [splitElements, handleMouseDown] = useSplit(
        new Array(items.length).fill(MINIMUM_ITEM_SIZE),
        Orientation.HORIZONTAL
    );

    useEffect(() => {
        setColumnSizes(splitElements.map((element) => `${element.length * 100}%`));
    }, [splitElements]);

    return (
        <div className={styles.header}>
            {items.map((item, index) => {
                if (index < items.length - 1) {
                    return (
                        <CellWithSeparator
                            key={index}
                            label={item}
                            flexBasis={columnSizes[index]}
                            onMouseDown={(ev) => handleMouseDown(index, ev)}
                        />
                    );
                }

                return (
                    <CellWithoutSeparator
                        key={index}
                        label={item}
                        flexBasis={columnSizes[index]}
                    />
                );
            })}
        </div>
    );
};

const CellWithSeparator = ({
    label,
    flexBasis,
    onMouseDown,
}: {
    label: string;
    flexBasis: string;
    onMouseDown: (ev: React.MouseEvent) => void;
}) => {
    return (
        <>
            <div
                className={styles.cell}
                style={{ flexBasis: flexBasis }}
            >
                {label}
            </div>
            <Separator onMouseDown={(ev) => onMouseDown(ev)}></Separator>
        </>
    );
};

const CellWithoutSeparator = ({
    label,
    flexBasis,
}: {
    label: string;
    flexBasis: string;
}) => {
    return (
        <div
            className={styles.cell}
            style={{ flexBasis: flexBasis }}
        >
            {label}
        </div>
    );
};
