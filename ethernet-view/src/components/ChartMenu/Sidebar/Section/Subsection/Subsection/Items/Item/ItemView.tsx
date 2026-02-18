import styles from "./ItemView.module.scss";
import { DragEvent } from "react";
import { FiBox } from "react-icons/fi";

export type Item = {
    id: string;
    name: string;
};

type Props = {
    item: Item;
};

export const ItemView = ({ item }: Props) => {
    function handleDragStart(ev: DragEvent<HTMLDivElement>) {
        ev.dataTransfer.setData("id", item.id);
    }

    return (
        <div
            className={styles.item}
            draggable="true"
            onDragStart={handleDragStart}
        >
            <FiBox /> {item.name}
        </div>
    );
};
