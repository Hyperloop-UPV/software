import {
    BooleanDescription,
    EnumDescription,
    NumericDescription,
    OrderFieldDescription,
} from "common";

export type FormField = NumericField | BooleanField | EnumField;

type AbstractFormField = {
    id: string;
    isValid: boolean;
    isEnabled: boolean;
};

export type NumericField = AbstractFormField &
    NumericDescription & {
        value: number;
    };

export type BooleanField = AbstractFormField &
    BooleanDescription & {
        value: boolean;
    };

export type EnumField = AbstractFormField &
    EnumDescription & {
        value: string;
    };

export type Form = {
    fields: FormField[];
    isValid: boolean;
};

export function areFieldsValid(fields: Array<FormField>): boolean {
    return fields.reduce((prevValid, currentField) => {
        return (
            prevValid &&
            ((currentField.isEnabled && currentField.isValid) ||
                !currentField.isEnabled)
        );
    }, true);
}

export function createForm(
    descriptions: Record<string, OrderFieldDescription>
): Form {
    const fields = Object.entries(descriptions).map(([_, fieldDescription]) => {
        const field = getFormField(fieldDescription);
        return field;
    });

    return { fields, isValid: areFieldsValid(fields) };
}

function getFormField(desc: OrderFieldDescription): FormField {
    if (desc.kind == "numeric") {
        return getNumericFormField(desc);
    } else if (desc.kind == "boolean") {
        return getBooleanFormField(desc);
    } else {
        return getEnumFormField(desc);
    }
}

function getNumericFormField(desc: NumericDescription): NumericField {
    return {
        id: desc.id,
        name: desc.name,
        kind: desc.kind,
        type: desc.type,
        safeRange: desc.safeRange,
        warningRange: desc.warningRange,
        value: 0,
        isValid: false,
        isEnabled: true,
    };
}
function getBooleanFormField(desc: BooleanDescription): BooleanField {
    return {
        id: desc.id,
        name: desc.name,
        kind: desc.kind,
        type: desc.type,
        value: false,
        isValid: true,
        isEnabled: true,
    };
}
function getEnumFormField(desc: EnumDescription): EnumField {
    return {
        id: desc.id,
        name: desc.name,
        kind: desc.kind,
        type: desc.type,
        options: desc.options,
        value: desc.options[0],
        isValid: true,
        isEnabled: true,
    };
}
