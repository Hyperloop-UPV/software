import styles from "components/FormComponents/Button/Button.module.scss";
import { animated, useSpring } from "@react-spring/web";
import { lightenHSL } from "utils/color";

type Props = {
    label?: string;
    icon?: string;
    onClick?: (ev: React.MouseEvent) => void;
    disabled?: boolean;
    color?: string;
    className?: string;
};

export const Button = ({
    label = undefined,
    icon = undefined,
    color = "hsl(29, 88%, 57%)",
    onClick = () => {},
    disabled = false,
    className = "",
}: Props) => {
    const [springs, api] = useSpring(() => ({
        from: { backgroundColor: color },
        config: {
            mass: 5,
            tension: 3000,
            friction: 1,
            clamp: true,
        },
    }));

    return (
        <animated.div
            className={`${styles.buttonWrapper} ${
                disabled ? styles.disabled : styles.enabled
            } ${className}`}
            onClick={(ev) => {
                if (!disabled) {
                    onClick(ev);
                }
                ev.stopPropagation();
            }}
            style={!disabled ? { ...springs } : {}}
            onMouseDown={() =>
                api.start({
                    to: { backgroundColor: lightenHSL(color, 15) },
                })
            }
            onMouseLeave={() =>
                api.start({
                    to: { backgroundColor: color },
                })
            }
            onMouseUp={() =>
                api.start({
                    to: { backgroundColor: color },
                })
            }
        >
            {icon && <img src={icon} alt="icon" className={styles.icon}/>}
            <span className={styles.label}>{label}</span>
        </animated.div>
    );
};
