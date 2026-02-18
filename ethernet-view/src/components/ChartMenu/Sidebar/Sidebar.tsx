import styles from "./Sidebar.module.scss";
import { Section } from "./Section/Section";
import { memo } from "react";
import { Item, ItemView } from "./Section/Subsection/Subsection/Items/Item/ItemView";

type Props = {
    sections?: Section[];
    items?: Item[];
};

const Sidebar = ({ sections, items }: Props) => {

    return sections && sections.length > 0 ?
    (
        <div className={styles.sidebar}>
            {sections.map((section) => {
                return (
                    <Section
                        key={section.name}
                        section={section}
                    />
                );
            })}
        </div>
    ) : (items && items.length > 0 ? (
        <div className={styles.sidebar}>
            {items.map((item) => {
                return (
                    // <div key={item.id} className={styles.subsection} draggable={true}>
                    //     <div className={styles.name}>{item.name}</div>
                    // </div>
                    <ItemView 
                        key={item.id}
                        item={item}
                    />
                );
            })}
        </div>
    ) : null);

};

export default memo(Sidebar);
