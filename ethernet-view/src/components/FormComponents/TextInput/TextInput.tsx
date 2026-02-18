import styles from "components/FormComponents/TextInput/TextInput.module.scss";

type Props = { isValid: boolean } & React.InputHTMLAttributes<HTMLInputElement>;

export const TextInput = ({ isValid, ...props }: Props) => {
    return (
        <input
            type="text"
            name=""
            className={`${styles.textInput} ${
                isValid ? styles.valid : styles.invalid
            } ${props.disabled ? styles.disabled : ""}`}
            {...props}
        />
    );
};
