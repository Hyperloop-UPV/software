package pod_data

import (
	"fmt"
	"strings"

	"github.com/HyperloopUPV-H8/h9-backend/pkg/adj"
	"github.com/HyperloopUPV-H8/h9-backend/internal/common"
	"github.com/HyperloopUPV-H8/h9-backend/internal/utils"
)

const EnumType = "enum"

func getMeasurements(measurementsADJ []adj.Measurement, globalUnits map[string]utils.Operations) ([]Measurement, error) {
	measurements := make([]Measurement, 0)
	mErrors := common.NewErrorList()

	for _, adjMeas := range measurementsADJ {
		meas, err := getMeasurement(adjMeas, globalUnits)
		if err != nil {
			mErrors.Add(err)
			continue
		}

		measurements = append(measurements, meas)
	}

	if len(mErrors) > 0 {
		return nil, mErrors
	}

	return measurements, nil
}

func getMeasurement(adjMeas adj.Measurement, globalUnits map[string]utils.Operations) (Measurement, error) {
	var tmp Measurement
	var err error

	if isNumeric(adjMeas.Type) {
		tmp, err = getNumericMeasurement(adjMeas, globalUnits)
	} else if adjMeas.Type == "bool" {
		tmp = getBooleanMeasurement(adjMeas)
	} else if strings.HasPrefix(adjMeas.Type, "enum") {
		tmp = getEnumMeasurement(adjMeas)
	} else {
		return nil, fmt.Errorf("type %s not recognized", adjMeas.Type)
	}
	return tmp, err
}

func getNumericMeasurement(adjMeas adj.Measurement, globalUnits map[string]utils.Operations) (NumericMeasurement, error) {
	measErrs := common.NewErrorList()

	displayUnits, err := utils.ParseUnits(adjMeas.DisplayUnits, globalUnits)
	if err != nil {
		measErrs.Add(err)
	}

	podUnits, err := utils.ParseUnits(adjMeas.PodUnits, globalUnits)
	if err != nil {
		measErrs.Add(err)
	}

	if len(measErrs) > 0 {
		return NumericMeasurement{}, measErrs
	}

	return NumericMeasurement{
		Id:           adjMeas.Id,
		Name:         adjMeas.Name,
		Type:         adjMeas.Type,
		Units:        displayUnits.Name,
		DisplayUnits: displayUnits,
		PodUnits:     podUnits,
		SafeRange:    adjMeas.SafeRange,
		WarningRange: adjMeas.WarningRange,
	}, nil
}

func getEnumMeasurement(adjMeas adj.Measurement) EnumMeasurement {
	return EnumMeasurement{
		Id:      adjMeas.Id,
		Name:    adjMeas.Name,
		Type:    EnumType,
		Options: adjMeas.EnumValues,
	}
}

func getBooleanMeasurement(adjMeas adj.Measurement) BooleanMeasurement {
	return BooleanMeasurement{
		Id:   adjMeas.Id,
		Name: adjMeas.Name,
		Type: adjMeas.Type,
	}
}

func isNumeric(kind string) bool {
	return kind == "uint8" ||
		kind == "uint16" ||
		kind == "uint32" ||
		kind == "uint64" ||
		kind == "int8" ||
		kind == "int16" ||
		kind == "int32" ||
		kind == "int64" ||
		kind == "float32" ||
		kind == "float64"
}
