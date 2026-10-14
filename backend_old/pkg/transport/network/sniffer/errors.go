package sniffer

import "github.com/google/gopacket"

// ErrMissingLayers is returned when a packet being read is missing its payload
type ErrMissingLayers struct {
	layers []gopacket.LayerType
}

// Layers returns the layers the decoded packet had, for debugging and error handling purposes.
func (err ErrMissingLayers) Layers() []gopacket.LayerType {
	return err.layers
}

func (err ErrMissingLayers) Error() string {
	return "missing expected layer"
}
