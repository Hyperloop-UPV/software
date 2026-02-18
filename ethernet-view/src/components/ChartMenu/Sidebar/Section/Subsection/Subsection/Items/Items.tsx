import { ItemView, Item } from "./Item/ItemView";
import styles from "./Items.module.scss";

type Props = {
    items: Item[];
};

export const Items = ({ items }: Props) => {
    return (
        <div className={styles.items}>
            {items.map((item) => {
                return (
                    <ItemView
                        key={item.id}
                        item={item}
                    />
                );
            })}
        </div>
    );
};
