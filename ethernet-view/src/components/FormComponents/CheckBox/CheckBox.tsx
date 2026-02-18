import styles from "components/FormComponents/CheckBox/CheckBox.module.scss";
import { ChangeEvent, useState } from "react";

type Props = {
    isRequired: boolean;
    onChange: (value: boolean) => void;
    disabled?: boolean;
    initialValue?: boolean;
    color?: string;
};

export const CheckBox = ({
    onChange,
    disabled = false,
    isRequired,
    initialValue = false,
    color,
}: Props) => {
    const [checked, setChecked] = useState(initialValue);

    return (
        <input
            type="checkbox"
            disabled={disabled}
            style={{ accentColor: color }}
            required={isRequired}
            onChange={(ev: ChangeEvent<HTMLInputElement>) => {
                onChange(Boolean(ev.target.checked));
                setChecked(Boolean(ev.target.checked));
            }}
            id={styles.checkBox}
            checked={checked}
        />
    );
};
