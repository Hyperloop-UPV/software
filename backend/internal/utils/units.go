package utils

import (
	"fmt"
	"log"
	"regexp"
	"strconv"
	"strings"
)

const (
	DecimalRegex = `[-+]?(\d*\.)?\d+(e[-+]?\d+)?`
	Separator    = "#"
)

var operationExp = regexp.MustCompile(fmt.Sprintf(`([+\-\/*]{1})(%s)`, DecimalRegex))

type Units struct {
	Name       string
	Operations Operations
}

func ParseUnits(literal string, globalUnits map[string]Operations) (Units, error) { // TODO: puede fallar si no tiene op y no estan en global o si las op que tiene estan mal
	if literal == "" {
		return Units{
			Name:       "",
			Operations: make(Operations, 0),
		}, nil
	}

	parts := strings.Split(literal, Separator)

	if parts[0] == literal { // literal doesn't contain Separator
		ops, ok := globalUnits[parts[0]]

		if !ok {
			return Units{}, fmt.Errorf("units \"%s\" not found in global", parts[0])
		}

		return Units{
			Name:       parts[0],
			Operations: ops,
		}, nil
	}

	if len(parts) != 2 {
		return Units{}, fmt.Errorf("units %v can only have 2 parts", parts)
	}

	operations, err := NewOperations(parts[1])

	if err != nil {
		return Units{}, err
	}

	return Units{
		Name:       parts[0],
		Operations: operations,
	}, nil
}

type Operations []Operation

func NewOperations(literal string) (Operations, error) {
	if literal == "" {
		return make(Operations, 0), nil
	}

	matches := operationExp.FindAllStringSubmatch(literal, -1)

	if matches == nil {
		return nil, fmt.Errorf("incorrect operations: %s", literal)
	}

	operations := make([]Operation, 0)
	for _, match := range matches {
		operation := getOperation(match[1], match[2])
		operations = append(operations, operation)
	}
	return operations, nil
}

func getOperation(operator string, operand string) Operation {
	numOperand, err := strconv.ParseFloat(operand, 64)
	if err != nil {
		log.Fatalln("units: operations: getOperation:", err)
	}
	return Operation{
		Operator: operator,
		Operand:  numOperand,
	}
}

func (operations Operations) Convert(value float64) float64 {
	result := value
	for _, op := range operations {
		result = op.convert(result)
	}
	return result
}

func (operations Operations) Revert(value float64) float64 {
	result := value
	for i := len(operations) - 1; i >= 0; i-- {
		result = operations[i].revert(result)
	}
	return result
}

type Operation struct {
	Operator string
	Operand  float64
}

func (operation Operation) convert(value float64) float64 {
	switch operation.Operator {
	case "+":
		return value + operation.Operand
	case "-":
		return value - operation.Operand
	case "*":
		return value * operation.Operand
	case "/":
		return value / operation.Operand
	}
	return value
}

func (operation Operation) revert(value float64) float64 {
	switch operation.Operator {
	case "+":
		return value - operation.Operand
	case "-":
		return value + operation.Operand
	case "*":
		return value / operation.Operand
	case "/":
		return value * operation.Operand
	}
	return value
}
