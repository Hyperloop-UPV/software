import styles from "./Section.module.scss";
import { Caret } from "components/Caret/Caret";
import { useState } from "react";
import { SubsectionsView } from "./Subsection/Subsections";
import { Subsection } from "./Subsection/Subsection/Subsection";

export type Section = {
    name: string;
    subsections: Subsection[];
};

type Props = {
    section: Section;
};

export const Section = ({ section }: Props) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div className={styles.section}>
            <div
                className={styles.header}
                onClick={() => {
                    setIsOpen((prev) => !prev);
                }}
            >
                <Caret isOpen={isOpen} />
                {section.name}
            </div>
            {isOpen && (
                <SubsectionsView
                    subsections={section.subsections}
                    isVisible={isOpen}
                />
            )}
        </div>
    );
};
