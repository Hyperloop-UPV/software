import styles from "./ResponseElement.module.scss";
import { HiCheckCircle } from "react-icons/hi";
import { MdCancel } from "react-icons/md";

type Props = {
    success: boolean;
};

export const ResponseElement = ({ success }: Props) => {
    return (
        <div className={styles.responseElementWrapper}>
            {success && (
                <>
                    <HiCheckCircle
                        className={`${styles.icon} ${styles.successIcon}`}
                    />
                    Success!
                </>
            )}
            {!success && (
                <>
                    <MdCancel
                        className={`${styles.icon} ${styles.failureIcon}`}
                    />
                    Error!
                </>
            )}
        </div>
    );
};
