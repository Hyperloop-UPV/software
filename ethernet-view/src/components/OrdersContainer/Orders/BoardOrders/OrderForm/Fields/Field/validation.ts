import {
    NumericType,
    isSignedIntegerType,
    isUnsignedIntegerType,
} from "BackendTypes";

export function isNumberValid(
    valueStr: string,
    numberType: NumericType,
    range: [number | null, number | null]
): boolean {
    if (stringIsNumber(valueStr, numberType)) {
        if (isUnsignedIntegerType(numberType)) {
            let isValid = true;
            if (range[0]) {
                isValid &&= Number.parseInt(valueStr) >= range[0];
            }

            if (range[1]) {
                isValid &&= Number.parseInt(valueStr) <= range[1];
            }

            return (
                isValid &&
                checkUnsignedIntegerOverflow(
                    Number.parseInt(valueStr),
                    getBits(numberType)
                )
            );
        } else if (isSignedIntegerType(numberType)) {
            let isValid = true;
            if (range[0]) {
                isValid &&= Number.parseInt(valueStr) >= range[0];
            }

            if (range[1]) {
                isValid &&= Number.parseInt(valueStr) <= range[1];
            }

            return (
                isValid &&
                checkSignedIntegerOverflow(
                    Number.parseInt(valueStr),
                    getBits(numberType)
                )
            );
        } else {
            let isValid = true;
            if (range[0]) {
                isValid &&= Number.parseFloat(valueStr) >= range[0];
            }

            if (range[1]) {
                isValid &&= Number.parseFloat(valueStr) <= range[1];
            }

            return isValid && checkFloatOverflow(Number.parseFloat(valueStr));
        }
    } else {
        return false;
    }
}

function stringIsNumber(valueStr: string, numberType: NumericType): boolean {
    if (isUnsignedIntegerType(numberType)) {
        return /^\d+$/.test(valueStr);
    } else if (isSignedIntegerType(numberType)) {
        return /^-?\d+$/.test(valueStr);
    } else {
        return /^-?\d+(?:\.\d+)?$/.test(valueStr);
    }
}

function checkUnsignedIntegerOverflow(value: number, bits: number): boolean {
    return value >= 0 && value <= Math.pow(2, bits) - 1;
}

function checkSignedIntegerOverflow(value: number, bits: number): boolean {
    const min = -Math.pow(2, bits - 1);
    const max = Math.pow(2, bits - 1) - 1;
    return value >= min && value <= max;
}

function checkFloatOverflow(value: number): boolean {
    return !Number.isNaN(value);
}

function getBits(type: NumericType): number {
    switch (type) {
        case "uint8":
            return 8;
        case "uint16":
            return 16;
        case "uint32":
            return 32;
        case "uint64":
            return 64;
        case "int8":
            return 8;
        case "int16":
            return 16;
        case "int32":
            return 32;
        case "int64":
            return 64;
        case "float32":
            return 32;
        case "float64":
            return 64;
    }
}
