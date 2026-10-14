package data

type valueConverter func(Value) Value
type valueReverter func(Value) Value

type ConversionDescriptor []Operation

type Operation struct {
	Operator string
	Operand  float64
}

func newConvertNumeric[N numeric](podConversion, displayConversion ConversionDescriptor) valueConverter {
	return func(value Value) Value {
		numeric := value.(NumericValue[N])
		numeric.inner = applyOperations(numeric.inner, podConversion)
		numeric.inner = revertOperations(numeric.inner, displayConversion)
		return numeric
	}
}

func newRevertNumeric[N numeric](podConversion, displayConversion ConversionDescriptor) valueReverter {
	return func(value Value) Value {
		numeric := value.(NumericValue[N])
		numeric.inner = applyOperationsInv(numeric.inner, displayConversion)
		numeric.inner = revertOperationsInv(numeric.inner, podConversion)
		return numeric
	}
}

func applyOperations[N numeric](original N, conversion ConversionDescriptor) N {
	for _, operation := range conversion {
		switch operation.Operator {
		case "+":
			original += N(operation.Operand)
		case "-":
			original -= N(operation.Operand)
		case "*":
			original *= N(operation.Operand)
		case "/":
			original /= N(operation.Operand)
		}
	}
	return original
}

func revertOperations[N numeric](original N, conversion ConversionDescriptor) N {
	for _, operation := range conversion {
		switch operation.Operator {
		case "+":
			original -= N(operation.Operand)
		case "-":
			original += N(operation.Operand)
		case "*":
			original /= N(operation.Operand)
		case "/":
			original *= N(operation.Operand)
		}
	}
	return original
}

func applyOperationsInv[N numeric](original N, conversion ConversionDescriptor) N {
	for i := len(conversion) - 1; i >= 0; i-- {
		operation := conversion[i]
		switch operation.Operator {
		case "+":
			original += N(operation.Operand)
		case "-":
			original -= N(operation.Operand)
		case "*":
			original *= N(operation.Operand)
		case "/":
			original /= N(operation.Operand)
		}
	}
	return original
}

func revertOperationsInv[N numeric](original N, conversion ConversionDescriptor) N {
	for i := len(conversion) - 1; i >= 0; i-- {
		operation := conversion[i]
		switch operation.Operator {
		case "+":
			original -= N(operation.Operand)
		case "-":
			original += N(operation.Operand)
		case "*":
			original /= N(operation.Operand)
		case "/":
			original *= N(operation.Operand)
		}
	}
	return original
}

func convertBoolean(value Value) Value {
	return value
}

func revertBoolean(value Value) Value {
	return value
}

func convertEnum(value Value) Value {
	return value
}

func revertEnum(value Value) Value {
	return value
}
