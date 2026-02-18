package presentation_test

import (
	"encoding/binary"
	"io"
	"reflect"
	"testing"

	"github.com/HyperloopUPV-H8/h9-backend/pkg/abstraction"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/transport/packet/data"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/transport/presentation"
	"github.com/rs/zerolog"
)

func TestEncoder(t *testing.T) {
	type testcase struct {
		name   string
		input  []abstraction.Packet
		output []byte
	}

	endianness := binary.LittleEndian

	testcases := []testcase{
		{
			name: "data 0",
			input: []abstraction.Packet{
				data.NewPacketWithValues(9, map[data.ValueName]data.Value{
					"uint8":  data.NewNumericValue[uint8](8),
					"uint16": data.NewNumericValue[uint16](8),
					"uint32": data.NewNumericValue[uint32](8),
					"uint64": data.NewNumericValue[uint64](8),
				}, make(map[data.ValueName]bool)),
			},
			output: (join(
				[]byte{0x09, 0x00},
				toBinary(uint8(8), endianness),
				toBinary(uint16(8), endianness),
				toBinary(uint32(8), endianness),
				toBinary(uint64(8), endianness),
			)),
		},
		{
			name: "data 1",
			input: []abstraction.Packet{
				data.NewPacketWithValues(10, map[data.ValueName]data.Value{
					"int8":  data.NewNumericValue[int8](8),
					"int16": data.NewNumericValue[int16](8),
					"int32": data.NewNumericValue[int32](8),
					"int64": data.NewNumericValue[int64](8),
				}, make(map[data.ValueName]bool)),
			},
			output: (join(
				[]byte{0x0a, 0x00},
				toBinary(int8(8), endianness),
				toBinary(int16(8), endianness),
				toBinary(int32(8), endianness),
				toBinary(int64(8), endianness),
			)),
		},
		{
			name: "data 2",
			input: []abstraction.Packet{
				data.NewPacketWithValues(11, map[data.ValueName]data.Value{
					"float32": data.NewNumericValue[float32](8),
					"float64": data.NewNumericValue[float64](8),
				}, make(map[data.ValueName]bool)),
			},
			output: (join(
				[]byte{0x0b, 0x00},
				toBinary(float32(8), endianness),
				toBinary(float64(8), endianness),
			)),
		},
		{
			name: "data 3",
			input: []abstraction.Packet{
				data.NewPacketWithValues(12, map[data.ValueName]data.Value{
					"bool": data.NewBooleanValue(true),
				}, make(map[data.ValueName]bool)),
			},
			output: (join(
				[]byte{0x0c, 0x00},
				[]byte{0x01},
			)),
		},
		{
			name: "data 4",
			input: []abstraction.Packet{
				data.NewPacketWithValues(13, map[data.ValueName]data.Value{
					"enum": data.NewEnumValue("c"),
				}, make(map[data.ValueName]bool)),
			},
			output: (join(
				[]byte{0x0d, 0x00},
				toBinary(uint8(2), endianness),
			)),
		},
		{
			name: "data 5",
			input: []abstraction.Packet{
				data.NewPacketWithValues(14, map[data.ValueName]data.Value{
					"uint8_1": data.NewNumericValue[uint8](8),
					"uint8_2": data.NewNumericValue[uint8](8),
					"float64": data.NewNumericValue[float64](8),
					"bool":    data.NewBooleanValue(true),
					"enum":    data.NewEnumValue("a"),
				}, make(map[data.ValueName]bool)),
			},
			output: (join(
				[]byte{0x0e, 0x00},
				toBinary(uint8(8), endianness),
				toBinary(uint8(8), endianness),
				toBinary(float64(8), endianness),
				[]byte{0x01},
				toBinary(uint8(0), endianness),
			)),
		},
		{
			name: "data 6",
			input: []abstraction.Packet{
				data.NewPacketWithValues(15, map[data.ValueName]data.Value{
					"bool_1": data.NewBooleanValue(true),
					"bool_2": data.NewBooleanValue(false),
					"bool_3": data.NewBooleanValue(false),
				}, make(map[data.ValueName]bool)),
			},
			output: (join(
				[]byte{0x0f, 0x00},
				[]byte{0x01},
				[]byte{0x00},
				[]byte{0x00},
			)),
		},
		{
			name: "data 7",
			input: []abstraction.Packet{
				data.NewPacketWithValues(16, map[data.ValueName]data.Value{
					"enum_1": data.NewEnumValue("b"),
					"enum_2": data.NewEnumValue("a"),
					"enum_3": data.NewEnumValue("d"),
					"enum_4": data.NewEnumValue("c"),
					"enum_5": data.NewEnumValue("h"),
				}, make(map[data.ValueName]bool)),
			},
			output: (join(
				[]byte{0x10, 0x00},
				toBinary(uint8(1), endianness),
				toBinary(uint8(0), endianness),
				toBinary(uint8(3), endianness),
				toBinary(uint8(2), endianness),
				toBinary(uint8(7), endianness),
			)),
		},
		{
			name: "data 8",
			input: []abstraction.Packet{
				data.NewPacketWithValues(17, map[data.ValueName]data.Value{
					"uint8_1":  data.NewNumericValue[uint8](8),
					"uint8_2":  data.NewNumericValue[uint8](8),
					"uint8_3":  data.NewNumericValue[uint8](8),
					"uint8_4":  data.NewNumericValue[uint8](8),
					"uint8_5":  data.NewNumericValue[uint8](8),
					"uint8_6":  data.NewNumericValue[uint8](8),
					"uint8_7":  data.NewNumericValue[uint8](8),
					"uint8_8":  data.NewNumericValue[uint8](8),
					"uint8_9":  data.NewNumericValue[uint8](8),
					"uint8_10": data.NewNumericValue[uint8](8),
				}, make(map[data.ValueName]bool)),
			},
			output: (join(
				[]byte{0x11, 0x00},
				toBinary(uint8(8), endianness),
				toBinary(uint8(8), endianness),
				toBinary(uint8(8), endianness),
				toBinary(uint8(8), endianness),
				toBinary(uint8(8), endianness),
				toBinary(uint8(8), endianness),
				toBinary(uint8(8), endianness),
				toBinary(uint8(8), endianness),
				toBinary(uint8(8), endianness),
				toBinary(uint8(8), endianness),
			)),
		},
		{
			name: "data 9",
			input: []abstraction.Packet{
				data.NewPacketWithValues(18, map[data.ValueName]data.Value{
					"uint64_1":  data.NewNumericValue[uint64](8),
					"int64_1":   data.NewNumericValue[int64](8),
					"float64_1": data.NewNumericValue[float64](8),
					"uint64_2":  data.NewNumericValue[uint64](8),
					"int64_2":   data.NewNumericValue[int64](8),
					"float64_2": data.NewNumericValue[float64](8),
					"uint64_3":  data.NewNumericValue[uint64](8),
					"int64_3":   data.NewNumericValue[int64](8),
					"float64_3": data.NewNumericValue[float64](8),
					"uint64_4":  data.NewNumericValue[uint64](8),
					"int64_4":   data.NewNumericValue[int64](8),
					"float64_4": data.NewNumericValue[float64](8),
					"uint64_5":  data.NewNumericValue[uint64](8),
					"int64_5":   data.NewNumericValue[int64](8),
					"float64_5": data.NewNumericValue[float64](8),
					"uint64_6":  data.NewNumericValue[uint64](8),
					"int64_6":   data.NewNumericValue[int64](8),
					"float64_6": data.NewNumericValue[float64](8),
				}, make(map[data.ValueName]bool)),
			},
			output: (join(
				[]byte{0x12, 0x00},
				toBinary(uint64(8), endianness),
				toBinary(int64(8), endianness),
				toBinary(float64(8), endianness),
				toBinary(uint64(8), endianness),
				toBinary(int64(8), endianness),
				toBinary(float64(8), endianness),
				toBinary(uint64(8), endianness),
				toBinary(int64(8), endianness),
				toBinary(float64(8), endianness),
				toBinary(uint64(8), endianness),
				toBinary(int64(8), endianness),
				toBinary(float64(8), endianness),
				toBinary(uint64(8), endianness),
				toBinary(int64(8), endianness),
				toBinary(float64(8), endianness),
				toBinary(uint64(8), endianness),
				toBinary(int64(8), endianness),
				toBinary(float64(8), endianness),
			)),
		},
		{
			name: "multiple",
			input: []abstraction.Packet{
				data.NewPacketWithValues(9, map[data.ValueName]data.Value{
					"uint8":  data.NewNumericValue[uint8](8),
					"uint16": data.NewNumericValue[uint16](8),
					"uint32": data.NewNumericValue[uint32](8),
					"uint64": data.NewNumericValue[uint64](8),
				}, make(map[data.ValueName]bool)),
				data.NewPacketWithValues(10, map[data.ValueName]data.Value{
					"int8":  data.NewNumericValue[int8](8),
					"int16": data.NewNumericValue[int16](8),
					"int32": data.NewNumericValue[int32](8),
					"int64": data.NewNumericValue[int64](8),
				}, make(map[data.ValueName]bool)),
				data.NewPacketWithValues(11, map[data.ValueName]data.Value{
					"float32": data.NewNumericValue[float32](8),
					"float64": data.NewNumericValue[float64](8),
				}, make(map[data.ValueName]bool)),
				data.NewPacketWithValues(12, map[data.ValueName]data.Value{
					"bool": data.NewBooleanValue(true),
				}, make(map[data.ValueName]bool)),
				data.NewPacketWithValues(13, map[data.ValueName]data.Value{
					"enum": data.NewEnumValue("c"),
				}, make(map[data.ValueName]bool)),
				data.NewPacketWithValues(14, map[data.ValueName]data.Value{
					"uint8_1": data.NewNumericValue[uint8](8),
					"uint8_2": data.NewNumericValue[uint8](8),
					"float64": data.NewNumericValue[float64](8),
					"bool":    data.NewBooleanValue(true),
					"enum":    data.NewEnumValue("a"),
				}, make(map[data.ValueName]bool)),
				data.NewPacketWithValues(15, map[data.ValueName]data.Value{
					"bool_1": data.NewBooleanValue(true),
					"bool_2": data.NewBooleanValue(false),
					"bool_3": data.NewBooleanValue(false),
				}, make(map[data.ValueName]bool)),
				data.NewPacketWithValues(16, map[data.ValueName]data.Value{
					"enum_1": data.NewEnumValue("b"),
					"enum_2": data.NewEnumValue("a"),
					"enum_3": data.NewEnumValue("d"),
					"enum_4": data.NewEnumValue("c"),
					"enum_5": data.NewEnumValue("h"),
				}, make(map[data.ValueName]bool)),
				data.NewPacketWithValues(17, map[data.ValueName]data.Value{
					"uint8_1":  data.NewNumericValue[uint8](8),
					"uint8_2":  data.NewNumericValue[uint8](8),
					"uint8_3":  data.NewNumericValue[uint8](8),
					"uint8_4":  data.NewNumericValue[uint8](8),
					"uint8_5":  data.NewNumericValue[uint8](8),
					"uint8_6":  data.NewNumericValue[uint8](8),
					"uint8_7":  data.NewNumericValue[uint8](8),
					"uint8_8":  data.NewNumericValue[uint8](8),
					"uint8_9":  data.NewNumericValue[uint8](8),
					"uint8_10": data.NewNumericValue[uint8](8),
				}, make(map[data.ValueName]bool)),
				data.NewPacketWithValues(18, map[data.ValueName]data.Value{
					"uint64_1":  data.NewNumericValue[uint64](8),
					"int64_1":   data.NewNumericValue[int64](8),
					"float64_1": data.NewNumericValue[float64](8),
					"uint64_2":  data.NewNumericValue[uint64](8),
					"int64_2":   data.NewNumericValue[int64](8),
					"float64_2": data.NewNumericValue[float64](8),
					"uint64_3":  data.NewNumericValue[uint64](8),
					"int64_3":   data.NewNumericValue[int64](8),
					"float64_3": data.NewNumericValue[float64](8),
					"uint64_4":  data.NewNumericValue[uint64](8),
					"int64_4":   data.NewNumericValue[int64](8),
					"float64_4": data.NewNumericValue[float64](8),
					"uint64_5":  data.NewNumericValue[uint64](8),
					"int64_5":   data.NewNumericValue[int64](8),
					"float64_5": data.NewNumericValue[float64](8),
					"uint64_6":  data.NewNumericValue[uint64](8),
					"int64_6":   data.NewNumericValue[int64](8),
					"float64_6": data.NewNumericValue[float64](8),
				}, make(map[data.ValueName]bool)),
			},
			output: (join(
				[]byte{0x09, 0x00},
				toBinary(uint8(8), endianness),
				toBinary(uint16(8), endianness),
				toBinary(uint32(8), endianness),
				toBinary(uint64(8), endianness),
				[]byte{0x0a, 0x00},
				toBinary(int8(8), endianness),
				toBinary(int16(8), endianness),
				toBinary(int32(8), endianness),
				toBinary(int64(8), endianness),
				[]byte{0x0b, 0x00},
				toBinary(float32(8), endianness),
				toBinary(float64(8), endianness),
				[]byte{0x0c, 0x00},
				[]byte{0x01},
				[]byte{0x0d, 0x00},
				toBinary(uint8(2), endianness),
				[]byte{0x0e, 0x00},
				toBinary(uint8(8), endianness),
				toBinary(uint8(8), endianness),
				toBinary(float64(8), endianness),
				[]byte{0x01},
				toBinary(uint8(0), endianness),
				[]byte{0x0f, 0x00},
				[]byte{0x01},
				[]byte{0x00},
				[]byte{0x00},
				[]byte{0x10, 0x00},
				toBinary(uint8(1), endianness),
				toBinary(uint8(0), endianness),
				toBinary(uint8(3), endianness),
				toBinary(uint8(2), endianness),
				toBinary(uint8(7), endianness),
				[]byte{0x11, 0x00},
				toBinary(uint8(8), endianness),
				toBinary(uint8(8), endianness),
				toBinary(uint8(8), endianness),
				toBinary(uint8(8), endianness),
				toBinary(uint8(8), endianness),
				toBinary(uint8(8), endianness),
				toBinary(uint8(8), endianness),
				toBinary(uint8(8), endianness),
				toBinary(uint8(8), endianness),
				toBinary(uint8(8), endianness),
				[]byte{0x12, 0x00},
				toBinary(uint64(8), endianness),
				toBinary(int64(8), endianness),
				toBinary(float64(8), endianness),
				toBinary(uint64(8), endianness),
				toBinary(int64(8), endianness),
				toBinary(float64(8), endianness),
				toBinary(uint64(8), endianness),
				toBinary(int64(8), endianness),
				toBinary(float64(8), endianness),
				toBinary(uint64(8), endianness),
				toBinary(int64(8), endianness),
				toBinary(float64(8), endianness),
				toBinary(uint64(8), endianness),
				toBinary(int64(8), endianness),
				toBinary(float64(8), endianness),
				toBinary(uint64(8), endianness),
				toBinary(int64(8), endianness),
				toBinary(float64(8), endianness),
			)),
		},
	}

	for _, test := range testcases {
		t.Run(test.name, func(t *testing.T) {
			encoder := getEncoder(endianness)

			output := make([]byte, 0, len(test.output))
			for i := 0; i < len(test.input); i++ {
				encoded, err := encoder.Encode(test.input[i])
				if err != nil {
					t.Fatalf("\nError encoding (%d) packet: %s\n", i+1, err)
				}

				output = append(output, encoded...)

			}

			if !reflect.DeepEqual(output, test.output) {
				t.Fatalf("\nGot %#v\nExpected %#v\n", output, test.output)
			}
		})
	}
}

// getEncoder generates a mock Encoder with the following packet IDs:
// 9:=18 - data
func getEncoder(endianness binary.ByteOrder) *presentation.Encoder {
	nullLogger := zerolog.New(io.Discard)
	encoder := presentation.NewEncoder(endianness, nullLogger)

	dataDecoder := data.NewEncoder(endianness)
	dataDecoder.SetDescriptor(9, data.Descriptor{
		data.NewNumericDescriptor[uint8]("uint8", make(data.ConversionDescriptor, 0), make(data.ConversionDescriptor, 0)),
		data.NewNumericDescriptor[uint16]("uint16", make(data.ConversionDescriptor, 0), make(data.ConversionDescriptor, 0)),
		data.NewNumericDescriptor[uint32]("uint32", make(data.ConversionDescriptor, 0), make(data.ConversionDescriptor, 0)),
		data.NewNumericDescriptor[uint64]("uint64", make(data.ConversionDescriptor, 0), make(data.ConversionDescriptor, 0)),
	})
	dataDecoder.SetDescriptor(10, data.Descriptor{
		data.NewNumericDescriptor[int8]("int8", make(data.ConversionDescriptor, 0), make(data.ConversionDescriptor, 0)),
		data.NewNumericDescriptor[int16]("int16", make(data.ConversionDescriptor, 0), make(data.ConversionDescriptor, 0)),
		data.NewNumericDescriptor[int32]("int32", make(data.ConversionDescriptor, 0), make(data.ConversionDescriptor, 0)),
		data.NewNumericDescriptor[int64]("int64", make(data.ConversionDescriptor, 0), make(data.ConversionDescriptor, 0)),
	})
	dataDecoder.SetDescriptor(11, data.Descriptor{
		data.NewNumericDescriptor[float32]("float32", make(data.ConversionDescriptor, 0), make(data.ConversionDescriptor, 0)),
		data.NewNumericDescriptor[float64]("float64", make(data.ConversionDescriptor, 0), make(data.ConversionDescriptor, 0)),
	})
	dataDecoder.SetDescriptor(12, data.Descriptor{
		data.NewBooleanDescriptor("bool"),
	})
	dataDecoder.SetDescriptor(13, data.Descriptor{
		data.NewEnumDescriptor("enum", data.EnumDescriptor{"a", "b", "c", "d"}),
	})
	dataDecoder.SetDescriptor(14, data.Descriptor{
		data.NewNumericDescriptor[uint8]("uint8_1", make(data.ConversionDescriptor, 0), make(data.ConversionDescriptor, 0)),
		data.NewNumericDescriptor[uint8]("uint8_2", make(data.ConversionDescriptor, 0), make(data.ConversionDescriptor, 0)),
		data.NewNumericDescriptor[float64]("float64", make(data.ConversionDescriptor, 0), make(data.ConversionDescriptor, 0)),
		data.NewBooleanDescriptor("bool"),
		data.NewEnumDescriptor("enum", data.EnumDescriptor{"a", "b", "c"}),
	})
	dataDecoder.SetDescriptor(15, data.Descriptor{
		data.NewBooleanDescriptor("bool_1"),
		data.NewBooleanDescriptor("bool_2"),
		data.NewBooleanDescriptor("bool_3"),
	})
	dataDecoder.SetDescriptor(16, data.Descriptor{
		data.NewEnumDescriptor("enum_1", data.EnumDescriptor{"a", "b", "c"}),
		data.NewEnumDescriptor("enum_2", data.EnumDescriptor{"a", "b"}),
		data.NewEnumDescriptor("enum_3", data.EnumDescriptor{"a", "b", "c", "d", "e"}),
		data.NewEnumDescriptor("enum_4", data.EnumDescriptor{"a", "b", "c", "d"}),
		data.NewEnumDescriptor("enum_5", data.EnumDescriptor{"a", "b", "c", "d", "e", "f", "g", "h", "i", "j"}),
	})
	dataDecoder.SetDescriptor(17, data.Descriptor{
		data.NewNumericDescriptor[uint8]("uint8_1", make(data.ConversionDescriptor, 0), make(data.ConversionDescriptor, 0)),
		data.NewNumericDescriptor[uint8]("uint8_2", make(data.ConversionDescriptor, 0), make(data.ConversionDescriptor, 0)),
		data.NewNumericDescriptor[uint8]("uint8_3", make(data.ConversionDescriptor, 0), make(data.ConversionDescriptor, 0)),
		data.NewNumericDescriptor[uint8]("uint8_4", make(data.ConversionDescriptor, 0), make(data.ConversionDescriptor, 0)),
		data.NewNumericDescriptor[uint8]("uint8_5", make(data.ConversionDescriptor, 0), make(data.ConversionDescriptor, 0)),
		data.NewNumericDescriptor[uint8]("uint8_6", make(data.ConversionDescriptor, 0), make(data.ConversionDescriptor, 0)),
		data.NewNumericDescriptor[uint8]("uint8_7", make(data.ConversionDescriptor, 0), make(data.ConversionDescriptor, 0)),
		data.NewNumericDescriptor[uint8]("uint8_8", make(data.ConversionDescriptor, 0), make(data.ConversionDescriptor, 0)),
		data.NewNumericDescriptor[uint8]("uint8_9", make(data.ConversionDescriptor, 0), make(data.ConversionDescriptor, 0)),
		data.NewNumericDescriptor[uint8]("uint8_10", make(data.ConversionDescriptor, 0), make(data.ConversionDescriptor, 0)),
	})
	dataDecoder.SetDescriptor(18, data.Descriptor{
		data.NewNumericDescriptor[uint64]("uint64_1", make(data.ConversionDescriptor, 0), make(data.ConversionDescriptor, 0)),
		data.NewNumericDescriptor[int64]("int64_1", make(data.ConversionDescriptor, 0), make(data.ConversionDescriptor, 0)),
		data.NewNumericDescriptor[float64]("float64_1", make(data.ConversionDescriptor, 0), make(data.ConversionDescriptor, 0)),
		data.NewNumericDescriptor[uint64]("uint64_2", make(data.ConversionDescriptor, 0), make(data.ConversionDescriptor, 0)),
		data.NewNumericDescriptor[int64]("int64_2", make(data.ConversionDescriptor, 0), make(data.ConversionDescriptor, 0)),
		data.NewNumericDescriptor[float64]("float64_2", make(data.ConversionDescriptor, 0), make(data.ConversionDescriptor, 0)),
		data.NewNumericDescriptor[uint64]("uint64_3", make(data.ConversionDescriptor, 0), make(data.ConversionDescriptor, 0)),
		data.NewNumericDescriptor[int64]("int64_3", make(data.ConversionDescriptor, 0), make(data.ConversionDescriptor, 0)),
		data.NewNumericDescriptor[float64]("float64_3", make(data.ConversionDescriptor, 0), make(data.ConversionDescriptor, 0)),
		data.NewNumericDescriptor[uint64]("uint64_4", make(data.ConversionDescriptor, 0), make(data.ConversionDescriptor, 0)),
		data.NewNumericDescriptor[int64]("int64_4", make(data.ConversionDescriptor, 0), make(data.ConversionDescriptor, 0)),
		data.NewNumericDescriptor[float64]("float64_4", make(data.ConversionDescriptor, 0), make(data.ConversionDescriptor, 0)),
		data.NewNumericDescriptor[uint64]("uint64_5", make(data.ConversionDescriptor, 0), make(data.ConversionDescriptor, 0)),
		data.NewNumericDescriptor[int64]("int64_5", make(data.ConversionDescriptor, 0), make(data.ConversionDescriptor, 0)),
		data.NewNumericDescriptor[float64]("float64_5", make(data.ConversionDescriptor, 0), make(data.ConversionDescriptor, 0)),
		data.NewNumericDescriptor[uint64]("uint64_6", make(data.ConversionDescriptor, 0), make(data.ConversionDescriptor, 0)),
		data.NewNumericDescriptor[int64]("int64_6", make(data.ConversionDescriptor, 0), make(data.ConversionDescriptor, 0)),
		data.NewNumericDescriptor[float64]("float64_6", make(data.ConversionDescriptor, 0), make(data.ConversionDescriptor, 0)),
	})
	encoder.SetPacketEncoder(9, dataDecoder)
	encoder.SetPacketEncoder(10, dataDecoder)
	encoder.SetPacketEncoder(11, dataDecoder)
	encoder.SetPacketEncoder(12, dataDecoder)
	encoder.SetPacketEncoder(13, dataDecoder)
	encoder.SetPacketEncoder(14, dataDecoder)
	encoder.SetPacketEncoder(15, dataDecoder)
	encoder.SetPacketEncoder(16, dataDecoder)
	encoder.SetPacketEncoder(17, dataDecoder)
	encoder.SetPacketEncoder(18, dataDecoder)

	return encoder
}
