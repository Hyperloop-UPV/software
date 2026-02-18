import styles from "./Counter.module.scss";

type Props = {
    count: number;
    className: string;
};

export const Counter = ({ count, className }: Props) => {
    return <div className={`${styles.counter} ${className}`}>{count}</div>;
};
