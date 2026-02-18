import { OrderFieldDescription } from "common";
import { useReducer } from "react";
import { Form, areFieldsValid, createForm, FormField } from "./form";

type Action = UpdateField | ChangeEnable;

type UpdateField = {
    type: "update_field";
    payload: {
        id: string;
        isValid: boolean;
        value: number | string | boolean;
    };
};

type ChangeEnable = {
    type: "change_enable";
    payload: {
        id: string;
        enable: boolean;
    };
};

function reducer(state: Form, action: Action): Form {
    switch (action.type) {
        case "update_field": {
            const fields: FormField[] = state.fields.map((field) => {
                if (field.id == action.payload.id) {
                    return {
                        ...field,
                        value: action.payload.value,
                        isValid: action.payload.isValid,
                    };
                }
                return field;
            }) as FormField[];

            return {
                fields,
                isValid: areFieldsValid(fields),
            };
        }

        case "change_enable": {
            const fields = state.fields.map((field) =>
                field.id == action.payload.id
                    ? { ...field, isEnabled: action.payload.enable }
                    : field
            );
            return {
                fields,
                isValid: areFieldsValid(fields),
            };
        }
    }
}

export function useForm(descriptions: Record<string, OrderFieldDescription>) {
    const [form, dispatch] = useReducer(reducer, descriptions, createForm);

    const updateField = (
        id: string,
        value: string | boolean | number,
        isValid: boolean
    ) =>
        dispatch({
            type: "update_field",
            payload: { id, value, isValid },
        });

    const changeEnable = (id: string, enable: boolean) =>
        dispatch({
            type: "change_enable",
            payload: { id, enable },
        });

    return { form, updateField, changeEnable } as const;
}
