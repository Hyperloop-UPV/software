import styles from './ProtectionView.module.scss';
import { ProtectionMessage } from 'common';

type Props = {
    protection: ProtectionMessage;
};

const DECIMALS = 2;

function safeFixed(val: any, decimals = DECIMALS) {
    return typeof val === "number" ? val.toFixed(decimals) : String(val);
}

export const ProtectionView = ({ protection }: Props) => {
    const ProtectionText = getProtectionText(protection);

    return <div className={styles.protectionView}>{ProtectionText}</div>;
};

function getProtectionText(protection: ProtectionMessage) {
    switch (protection.payload.kind) {
        case "OUT_OF_BOUNDS":
            return (
                <>
                    <span>
                        {" "}
                        Want: [
                        {safeFixed(protection.payload.data.bounds?.[0])}, {safeFixed(protection.payload.data.bounds?.[1])}]
                    </span>{" "}
                    <span>Got: {safeFixed(protection.payload.data.value)}</span>
                </>
            );
        case "UPPER_BOUND":
            return (
                <>
                    <span>
                        Want: [{protection.name}] {"<"} {safeFixed(protection.payload.data.bound)}
                    </span>{" "}
                    <span>Got: {safeFixed(protection.payload.data.value)}</span>
                </>
            );
        case "LOWER_BOUND":
            return (
                <>
                    <span>
                        Want: [{protection.name}] {">"} {safeFixed(protection.payload.data.bound)}
                    </span>{" "}
                    <span>Got: {safeFixed(protection.payload.data.value)}</span>
                </>
            );
        case "EQUALS":
            return (
                <>
                    <span>
                        Mustn't be {safeFixed(protection.payload.data.value)}
                    </span>
                </>
            );
        case "NOT_EQUALS":
            return (
                <>
                    <span>
                        Must be {safeFixed(protection.payload.data.want)} but is{" "}
                        {safeFixed(protection.payload.data.value)}
                    </span>
                </>
            );
        case "TIME_ACCUMULATION":
            return (
                <span>
                    Value was {safeFixed(protection.payload.data.value)} for{" "}
                    {safeFixed(protection.payload.data.timelimit)} seconds
                </span>
            );
        case "ERROR_HANDLER":
            return <span>{protection.payload.data}</span>;
    }
}
