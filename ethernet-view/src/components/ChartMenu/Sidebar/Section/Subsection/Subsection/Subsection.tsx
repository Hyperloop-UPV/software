import styles from "./Subsection.module.scss";
import { Items } from "./Items/Items";
import { Item } from "./Items/Item/ItemView";

export type Subsection = {
    name: string;
    items: Item[];
};

type Props = {
    subsection: Subsection;
};

export const SubsectionView = ({ subsection }: Props) => {
    return (
        <div className={styles.subsection}>
            <div className={styles.name}>{subsection.name}</div>
            <Items items={subsection.items} />
        </div>
    );
};
