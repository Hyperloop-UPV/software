package packet_parser

import "encoding/binary"

type Config struct {
	ByteOrder string `toml:"byte_order,omitempty"`
}

func (config Config) GetByteOrder() binary.ByteOrder {
	switch config.ByteOrder {
	case "LittleEndian":
		return binary.LittleEndian
	case "BigEndian":
		return binary.BigEndian
	default:
		return binary.LittleEndian
	}
}
