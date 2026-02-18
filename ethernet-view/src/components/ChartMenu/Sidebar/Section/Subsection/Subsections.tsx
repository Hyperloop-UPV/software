import styles from "./Subsections.module.scss";
import { Subsection, SubsectionView } from "./Subsection/Subsection";

type Props = {
    subsections: Subsection[];
    isVisible: boolean;
};

export const SubsectionsView = ({ subsections, isVisible }: Props) => {
    return (
        <div
            className={styles.subsections}
            style={{ height: isVisible ? "auto" : "0" }}
        >
            {subsections.map((subsection) => {
                return (
                    <SubsectionView
                        key={subsection.name}
                        subsection={subsection}
                    />
                );
            })}
        </div>
    );
};
