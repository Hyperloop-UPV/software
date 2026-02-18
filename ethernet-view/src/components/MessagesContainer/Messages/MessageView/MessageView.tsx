import styles from "./MessageView.module.scss";
import React from "react";
import { Counter } from "./Counter/Counter";
import { Message } from "common";

import { ReactComponent as Info } from "assets/svg/info.svg";
import { ReactComponent as Warning } from "assets/svg/warning.svg";
import { ReactComponent as Fault } from "assets/svg/fault.svg";

import { TimestampView } from "./TimestampView/TimestampView";
import { ProtectionMessageView } from "./ProtectionMessageView/ProtectionMessageView";
import { InfoMessageView } from "./InfoMessageView/InfoMessageView";

type Props = {
    message: Message;
};

const icons = {
    info: Info,
    fault: Fault,
    warning: Warning,
    ok: Info,
};

const appearances = {
    info: styles.info,
    warning: styles.warning,
    fault: styles.fault,
    ok: styles.info,
};

export const MessageView = React.memo(({ message }: Props) => {
    const Icon = icons[message.kind];
    const appearance = appearances[message.kind];

    const Message =
        message.kind == "warning" || message.kind == "fault" || message.kind == "ok" ? (
            <ProtectionMessageView
                message={message}
                className={styles.content}
            />
        ) : (
            <InfoMessageView
                message={message}
                className={styles.content}
            />
        );

    return (
        <article className={`${styles.message} ${appearance}`}>
            <Icon className={styles.icon} />
            {Message}
            <Counter
                className={styles.counter}
                count={message.count}
            />
            <TimestampView
                className={styles.timestamp}
                timestamp={message.timestamp}
            />
        </article>
    );
});
