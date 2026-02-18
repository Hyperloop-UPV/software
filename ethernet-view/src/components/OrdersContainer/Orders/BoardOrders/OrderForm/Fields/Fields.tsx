import styles from "./Fields.module.scss";
import { Field } from "./Field/Field";
import { FormField } from "../form";

type Props = {
    fields: FormField[];
    updateField: (
        id: string,
        value: boolean | string | number,
        isValid: boolean
    ) => void;
    changeEnable: (id: string, isEnabled: boolean) => void;
};

export const Fields = ({ fields, updateField, changeEnable }: Props) => {
    return (
        <div className={styles.fieldsWrapper}>
            {fields.map((field) => {
                return (
                    <Field
                        key={field.id}
                        name={field.name}
                        field={field}
                        onChange={(
                            newValue: string | number | boolean,
                            isValid: boolean
                        ) => {
                            updateField(field.id, newValue, isValid);
                        }}
                        changeEnabled={(value) => changeEnable(field.id, value)}
                    />
                );
            })}
        </div>
    );
};
