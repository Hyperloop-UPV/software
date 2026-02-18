import { TextInput } from "../TextInput/TextInput";

type Props = {
    required: boolean;
    defaultValue: number | string;
    placeholder: string;
    disabled: boolean;
    isValid: boolean;
    onChange: (value: string) => void;
};

function getUnion(arr: string[]): string {
    return arr.map((value) => `(?:${value})`).join("|");
}

const numericInputKeyRegex = (() => {
    const arrows = ["ArrowUp", "ArrowLeft", "ArrowRight", "ArrowDown"];
    const controlKeys = ["Delete", "Backspace", "Home", "End"]; // Home es inicio
    const chars = "[0-9.+-]";

    const regexp = chars + "|" + getUnion(arrows) + "|" + getUnion(controlKeys);

    return new RegExp(regexp);
})();

export const NumericInput = ({
    onChange,
    required,
    disabled,
    isValid,
    placeholder,
    defaultValue,
}: Props) => {
    return (
        <TextInput
            isValid={isValid}
            disabled={disabled}
            placeholder={placeholder}
            defaultValue={defaultValue}
            required={required}
            onKeyDown={(ev) => {
                if (!numericInputKeyRegex.test(ev.key)) {
                    ev.preventDefault();
                    return false;
                }
            }}
            onChange={(ev) => {
                onChange(ev.target.value);
            }}
        />
    );
};
