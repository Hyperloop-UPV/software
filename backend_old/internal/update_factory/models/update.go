package models

type Update struct {
	Id        uint16                 `json:"id"`
	HexValue  string                 `json:"hexValue"`
	Count     uint64                 `json:"count"`
	CycleTime uint64                 `json:"cycleTime"`
	Values    map[string]UpdateValue `json:"measurementUpdates"`
}

type UpdateValue interface {
	Kind() string
}

type NumericValue struct {
	Value   float64 `json:"last"`
	Average float64 `json:"average"`
}

func (numeric NumericValue) Kind() string {
	return "numeric"
}

type BooleanValue bool

func (boolean BooleanValue) Kind() string {
	return "boolean"
}

type EnumValue string

func (enum EnumValue) Kind() string {
	return "enum"
}
