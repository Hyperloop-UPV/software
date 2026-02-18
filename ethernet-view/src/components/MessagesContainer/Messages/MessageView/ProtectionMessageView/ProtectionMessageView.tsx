import { ProtectionMessage } from "common";
import styles from "./ProtectionMessageView.module.scss";
import { Origin } from "./Origin/Origin";
import { ProtectionView } from "./ProtectionView/ProtectionView";

type Props = {
    message: ProtectionMessage;
    className: string;
};

export const ProtectionMessageView = ({ message, className }: Props) => {
    return (
        <div className={`${styles.protectionMessage} ${className}`}>
            <div className={styles.kindAndOrigin}>
                <div className={styles.protectionKind}>
                    {message.payload.kind}
                </div>
                <Origin
                    className={styles.origin}
                    board={message.board}
                    name={message.name}
                />
            </div>
            <ProtectionView protection={message} />
        </div>
    );
};
