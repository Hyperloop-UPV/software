import { Caret } from "components/Caret/Caret";
import styles from "./Header.module.scss";

type Props = {
    name: string;
    open: boolean;
    onClick: () => void;
};

export const Header = ({ name, open, onClick }: Props) => {
    return (
        <div
            className={styles.header}
            onClick={onClick}
        >
            <Caret isOpen={open} />
            {name}
        </div>
    );
};
