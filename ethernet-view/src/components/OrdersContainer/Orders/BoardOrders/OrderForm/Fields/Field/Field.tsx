import styles from "./Field.module.scss";
import { CheckBox } from "components/FormComponents/CheckBox/CheckBox";
import { Dropdown } from "components/FormComponents/Dropdown/Dropdown";
import { NumericType } from "common";
import { isNumberValid } from "./validation";
import { NumericInput } from "components/FormComponents/NumericInput/NumericInput";
import { FormField } from "../../form";

type Props = {
    name: string;
    field: FormField;
    onChange: (newValue: boolean | string | number, isValid: boolean) => void;
    changeEnabled: (isEnabled: boolean) => void;
};

export const Field = ({ name, field, onChange, changeEnabled }: Props) => {
    function handleTextInputChange(
        value: string,
        type: NumericType,
        range: [number | null, number | null]
    ) {
        const isValid = isNumberValid(value, type, range);
        onChange(Number.parseFloat(value), isValid);
    }

    return (
        <div
            className={`${styles.fieldWrapper} ${
                !field.isEnabled ? styles.disabled : ""
            }`}
        >
            <div className={styles.name}>{name}</div>
            {field.kind == "numeric" ? (
                <NumericInput
                    required={field.isEnabled}
                    disabled={!field.isEnabled}
                    isValid={field.isValid}
                    placeholder={`${field.type}...`}
                    defaultValue={!field.isValid ? "" : (field.value as number)}
                    onChange={(value) =>
                        handleTextInputChange(
                            value,
                            field.type,
                            field.safeRange
                        )
                    }
                />
            ) : field.kind == "boolean" ? (
                <CheckBox
                    isRequired={field.isEnabled}
                    disabled={!field.isEnabled}
                    onChange={(value: boolean) => {
                        onChange(value, true);
                    }}
                />
            ) : (
                <Dropdown
                    value={field.value as string}
                    options={field.options}
                    onChange={(newValue) => {
                        onChange(newValue, true);
                    }}
                />
            )}

            <CheckBox
                color="orange"
                isRequired={true}
                onChange={changeEnabled}
                initialValue={field.isEnabled}
            />
        </div>
    );
};
