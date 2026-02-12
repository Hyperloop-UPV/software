package main

import (
	"encoding/binary"
	"testing"

	"github.com/HyperloopUPV-H8/h9-backend/pkg/abstraction"
	adj_module "github.com/HyperloopUPV-H8/h9-backend/pkg/adj"
)

func TestGetBoardPackets_FiltersOnlyDataPackets(t *testing.T) {
	board := adj_module.Board{
		Name: "VCU",
		Packets: []adj_module.Packet{
			{Id: abstraction.PacketId(100), Name: "DataA", Type: "data", VariablesIds: []string{"a"}},
			{Id: abstraction.PacketId(200), Name: "OrderA", Type: "order", VariablesIds: []string{"b"}},
			{Id: abstraction.PacketId(300), Name: "StateOrderA", Type: "stateOrder", VariablesIds: []string{"c"}},
			{Id: abstraction.PacketId(400), Name: "DataB", Type: "data", VariablesIds: []string{"d"}},
		},
	}

	bc := boardConn{board: board}
	getBoardPackets(&bc)

	if len(bc.packets) != 2 {
		t.Fatalf("expected 2 data packets, got %d", len(bc.packets))
	}

	if bc.packets[0].Type != "data" || bc.packets[1].Type != "data" {
		t.Fatalf("expected all packets to be type=data, got %q and %q", bc.packets[0].Type, bc.packets[1].Type)
	}

	if bc.packets[0].Id != 100 || bc.packets[1].Id != 400 {
		t.Fatalf("unexpected packet IDs: got %d and %d", bc.packets[0].Id, bc.packets[1].Id)
	}
}

func TestGetBoardPackets_EmptyInputProducesEmptyOutput(t *testing.T) {
	bc := boardConn{
		board: adj_module.Board{
			Name:    "EmptyBoard",
			Packets: nil,
		},
	}

	getBoardPackets(&bc)

	if len(bc.packets) != 0 {
		t.Fatalf("expected 0 packets, got %d", len(bc.packets))
	}
}

func TestCreateRandomPacket_NoPackets_ReturnsNil(t *testing.T) {
	bc := boardConn{packets: nil}
	got := bc.CreateRandomPacket()
	if got != nil {
		t.Fatalf("expected nil, got %v", got)
	}
}

func TestCreateRandomPacket_NoVariables_ReturnsNil(t *testing.T) {
	bc := boardConn{
		packets: []adj_module.Packet{
			{
				Id:           abstraction.PacketId(42),
				Type:         "data",
				Variables:    nil,
				VariablesIds: nil,
			},
		},
	}

	got := bc.CreateRandomPacket()
	if got != nil {
		t.Fatalf("expected nil when packet has no variables, got %v", got)
	}
}

func TestCreateRandomPacket_StringMeasurement_ReturnsNil(t *testing.T) {
	bc := boardConn{
		packets: []adj_module.Packet{
			{
				Id: abstraction.PacketId(7),
				Type: "data",
				VariablesIds: []string{"s"},
				Variables: []adj_module.Measurement{
					{Id: "s", Name: "S", Type: "string"},
				},
			},
		},
	}

	got := bc.CreateRandomPacket()
	if got != nil {
		t.Fatalf("expected nil for string measurement, got %v", got)
	}
}

func TestCreateRandomPacket_BoolPacket_HasIDAndPayload(t *testing.T) {
	bc := boardConn{
		packets: []adj_module.Packet{
			{
				Id: abstraction.PacketId(513), // 0x0201
				Type: "data",
				VariablesIds: []string{"b"},
				Variables: []adj_module.Measurement{
					{Id: "b", Name: "B", Type: "bool"},
				},
			},
		},
	}

	got := bc.CreateRandomPacket()
	if got == nil {
		t.Fatal("expected non-nil packet")
	}

	// 2 bytes ID + 1 byte bool
	if len(got) != 3 {
		t.Fatalf("expected len=3, got %d", len(got))
	}

	id := binary.LittleEndian.Uint16(got[:2])
	if id != 513 {
		t.Fatalf("expected id=513, got %d", id)
	}

	if got[2] != 0 && got[2] != 1 {
		t.Fatalf("expected bool payload byte 0 or 1, got %d", got[2])
	}
}

func TestCreateRandomPacket_EnumPacket_HasIDAndEnumByte(t *testing.T) {
	bc := boardConn{
		packets: []adj_module.Packet{
			{
				Id: abstraction.PacketId(10),
				Type: "data",
				VariablesIds: []string{"mode"},
				Variables: []adj_module.Measurement{
					{Id: "mode", Name: "Mode", Type: "enum(OFF,ON,FAULT)"},
				},
			},
		},
	}

	got := bc.CreateRandomPacket()
	if got == nil {
		t.Fatal("expected non-nil packet")
	}

	// 2 bytes ID + 1 byte enum
	if len(got) != 3 {
		t.Fatalf("expected len=3, got %d", len(got))
	}

	id := binary.LittleEndian.Uint16(got[:2])
	if id != 10 {
		t.Fatalf("expected id=10, got %d", id)
	}

	enumVal := got[2]
	if enumVal > 2 {
		t.Fatalf("expected enum byte in [0..2], got %d", enumVal)
	}
}

func TestCreateRandomPacket_NumericPacket_HasIDAndNumericPayload(t *testing.T) {
	bc := boardConn{
		packets: []adj_module.Packet{
			{
				Id: abstraction.PacketId(20),
				Type: "data",
				VariablesIds: []string{"rpm"},
				Variables: []adj_module.Measurement{
					{
						Id:           "rpm",
						Name:         "RPM",
						Type:         "uint16",
						WarningRange: []*float64{}, // force fallback path
					},
				},
			},
		},
	}

	got := bc.CreateRandomPacket()
	if got == nil {
		t.Fatal("expected non-nil packet")
	}

	// 2 bytes ID + 2 bytes uint16
	if len(got) != 4 {
		t.Fatalf("expected len=4, got %d", len(got))
	}

	id := binary.LittleEndian.Uint16(got[:2])
	if id != 20 {
		t.Fatalf("expected id=20, got %d", id)
	}

	// just ensure numeric payload exists and is parseable
	_ = binary.LittleEndian.Uint16(got[2:4])
}