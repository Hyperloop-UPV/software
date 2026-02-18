import styles from "components/Caret/Caret.module.scss";
import { BsFillCaretRightFill } from "react-icons/bs";
type Props = {
    isOpen: boolean;
    onClick?: () => void;
    className?: string;
};

export const Caret = ({ isOpen, onClick, className = "" }: Props) => {
    return (
        <div
            className={`${styles.caretWrapper} ${className}`}
            onClick={onClick}
            style={{ transform: isOpen ? "rotate(90deg)" : "" }}
        >
            {<BsFillCaretRightFill />}
        </div>
    );
};
