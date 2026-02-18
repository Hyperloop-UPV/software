import styles from "components/FormComponents/Dropdown/Dropdown.module.scss";

type Props = {
    value?: string;
    options: string[];
    onChange: (newValue: string) => void;
};

export const Dropdown = ({ value, options, onChange }: Props) => {
    return (
        <select
            name=""
            className={styles.select}
            value={value}
            onChange={(ev) => onChange(ev.target.value)}
        >
            {options.map((option, index) => {
                return (
                    <option
                        key={index}
                        value={option}
                    >
                        {option}
                    </option>
                );
            })}
        </select>
    );
};
