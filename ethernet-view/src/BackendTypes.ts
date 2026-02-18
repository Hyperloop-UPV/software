export type BackendType = NumericType | Bool | Enum;

export type NumericType =
    | SignedIntegerType
    | UnsignedIntegerType
    | FloatingType;

export type SignedIntegerType = "int8" | "int16" | "int32" | "int64";

export type UnsignedIntegerType = "uint8" | "uint16" | "uint32" | "uint64";

export type FloatingType = "float32" | "float64";

export function isNumericType(type: string): type is NumericType {
    return (
        isUnsignedIntegerType(type) ||
        isSignedIntegerType(type) ||
        isFloatingType(type)
    );
}

export function isUnsignedIntegerType(
    type: string
): type is UnsignedIntegerType {
    return (
        type == "uint8" ||
        type == "uint16" ||
        type == "uint32" ||
        type == "uint64"
    );
}

export function isSignedIntegerType(type: string): type is SignedIntegerType {
    return (
        type == "int8" || type == "int16" || type == "int32" || type == "int64"
    );
}

export function isFloatingType(type: string): type is FloatingType {
    return type == "float32" || type == "float64";
}

type Enum = "enum";
type Bool = "bool";
