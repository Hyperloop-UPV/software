package boards_test

import (
	"testing"

	"github.com/HyperloopUPV-H8/h9-backend/pkg/abstraction"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/boards"
	blcu_topic "github.com/HyperloopUPV-H8/h9-backend/pkg/broker/topics/blcu"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/vehicle"
	"github.com/rs/zerolog"
)

// TestBLCUBoardRegistration tests that BLCU board can be registered with different configurations
func TestBLCUBoardRegistration(t *testing.T) {
	logger := zerolog.New(nil).Level(zerolog.Disabled)
	v := vehicle.New(logger)
	
	// Test deprecated constructor (should use board ID 0)
	blcuBoard := boards.New("192.168.0.10")
	v.AddBoard(blcuBoard)
	
	// Verify board is registered with ID 0 (missing configuration)
	if blcuBoard.Id() != 0 {
		t.Errorf("Expected board ID 0 for deprecated constructor, got %d", blcuBoard.Id())
	}
}

// TestBLCUWithCustomConfiguration tests BLCU with custom board ID and order IDs
func TestBLCUWithCustomConfiguration(t *testing.T) {
	logger := zerolog.New(nil).Level(zerolog.Disabled)
	v := vehicle.New(logger)
	
	// Test new constructor with custom configuration
	tftpConfig := boards.TFTPConfig{
		BlockSize:      131072,
		Retries:        3,
		TimeoutMs:      5000,
		BackoffFactor:  2,
		EnableProgress: true,
	}
	
	customBoardId := abstraction.BoardId(7)
	customDownloadOrderId := uint16(801)
	customUploadOrderId := uint16(802)
	
	blcuBoard := boards.NewWithConfig("192.168.0.10", tftpConfig, customBoardId, customDownloadOrderId, customUploadOrderId)
	v.AddBoard(blcuBoard)
	
	// Verify board is registered with custom ID
	if blcuBoard.Id() != customBoardId {
		t.Errorf("Expected board ID %d, got %d", customBoardId, blcuBoard.Id())
	}
}

// TestBLCUWithDefaultConfiguration tests BLCU with default order IDs
func TestBLCUWithDefaultConfiguration(t *testing.T) {
	logger := zerolog.New(nil).Level(zerolog.Disabled)
	v := vehicle.New(logger)
	
	// Test deprecated constructor (should use default order IDs)
	tftpConfig := boards.TFTPConfig{
		BlockSize:      131072,
		Retries:        3,
		TimeoutMs:      5000,
		BackoffFactor:  2,
		EnableProgress: true,
	}
	
	boardId := abstraction.BoardId(7)
	blcuBoard := boards.NewWithTFTPConfig("192.168.0.10", tftpConfig, boardId)
	v.AddBoard(blcuBoard)
	
	// Verify board is registered
	if blcuBoard.Id() != boardId {
		t.Errorf("Expected board ID %d, got %d", boardId, blcuBoard.Id())
	}
}

// TestBLCURequestStructures tests the request structures
func TestBLCURequestStructures(t *testing.T) {
	// Test download request
	downloadReq := &blcu_topic.DownloadRequest{
		Board: "VCU",
	}
	if downloadReq.Topic() != "blcu/downloadRequest" {
		t.Errorf("Expected topic 'blcu/downloadRequest', got '%s'", downloadReq.Topic())
	}
	
	// Test upload request
	uploadReq := &blcu_topic.UploadRequest{
		Board: "VCU",
		File:  "dGVzdCBkYXRh", // base64 for "test data"
	}
	if uploadReq.Topic() != "blcu/uploadRequest" {
		t.Errorf("Expected topic 'blcu/uploadRequest', got '%s'", uploadReq.Topic())
	}
	
	// Test internal upload request
	uploadReqInternal := &blcu_topic.UploadRequestInternal{
		Board: "VCU",
		Data:  []byte("test data"),
	}
	if uploadReqInternal.Topic() != "blcu/uploadRequest" {
		t.Errorf("Expected topic 'blcu/uploadRequest', got '%s'", uploadReqInternal.Topic())
	}
}