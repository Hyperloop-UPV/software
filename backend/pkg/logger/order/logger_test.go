package order

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	loggerHandler "github.com/HyperloopUPV-H8/h9-backend/pkg/logger"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/transport/packet/data"
)

func createLoggerForTest(t *testing.T) *Logger {

	t.Helper() // Marks this function as a test helper, avoids cluttering test output

	logger := NewLogger()
	return logger
}

// chdirTemp changes the current working directory to a temporary directory for the duration of the test.
func chdirTemp(t *testing.T) string {
	t.Helper()
	tmp := t.TempDir()
	old, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	if err := os.Chdir(tmp); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.Chdir(old) })
	return tmp
}

func splitPath(p string) []string {
	p = filepath.Clean(p)
	return strings.Split(p, string(os.PathSeparator))
}

/*******
* Start *
*******/

func TestStart(t *testing.T) {

	_ = chdirTemp(t) // Change to a temporary directory

	logger := createLoggerForTest(t)

	// Sample data

	var startTime int64

	t.Run("Start (first time)", func(t *testing.T) {

		// First start should succeed
		out := logger.Start()

		if out != nil {
			t.Fatalf("expected nil, got %v", out)
		}
		// Capture start time
		startTime = logger.StartTime

	})

	t.Run("Start (not first time)", func(t *testing.T) {

		// El test Start (first time) debe haber tenido éxito y haber establecido startTime
		if startTime == 0 {
			t.Fatal("precondition failed: StartTime should be set from the first start")
		}

		// Subsequent starts shouldn't change startTime
		out := logger.Start()
		if out != nil {
			t.Fatalf("expected nil, got %v", out)
		}
		if logger.StartTime != startTime {
			t.Fatalf("expected startTime to be %d, got %d", startTime, logger.StartTime)
		}
	})

}

/***********************************************
* Push Record (toggling between Start and Stop) *
***********************************************/

func TestPushRecord(t *testing.T) {

	_ = chdirTemp(t) // Change to a temporary directory

	logger := createLoggerForTest(t)

	packet := data.NewPacket(1)

	record := Record{
		Packet:    packet,
		From:      "test-BOARD",
		To:        "Logger",
		Timestamp: time.Now(),
	}

	t.Run("Write when log is not started", func(t *testing.T) {

		// Push logger
		logger.PushRecord(&record)

		// Verify that the logger was not created

		if _, err := os.Stat("logger"); err == nil {
			// El archivo SÍ existe
			t.Fatalf("expected file to not exist, but it does")
		}

	})

	// Starts the order log
	logger.Start()

	// Start the logger
	t.Run("Write when log is started", func(t *testing.T) {
		logger.PushRecord(&record)
		filePath := filepath.Join(
			"logger",
			loggerHandler.Timestamp.Format(loggerHandler.TimestampFormat),
			"order",
			"order.csv")
		time.Sleep(2 * time.Second)

		// reads the file
		data, err := os.ReadFile(filePath)
		if err != nil {
			t.Fatalf("file could not be read: %v", err)
		}

		line := strings.TrimSpace(string(data))
		if line == "" {
			t.Fatalf("file %s is empty", filePath)
		}

		// split the line by commas
		fields := strings.Split(line, ",")
		if len(fields) < 6 {
			t.Fatalf("CSV line has fewer than 6 fields: %s", line)
		}

		// Check that the log contains the right data (impossible to check first and last field)
		if !strings.Contains(line, "test-BOARD,Logger,1,map[],") {
			t.Errorf("test-BOARD,Logger,1,map[], was not found inside the logger/orden file")
		}

	})

}

/*************
* Create File *
*************/

func TestCreateFile(t *testing.T) {

	// Try to create the file sucessfully
	t.Run("Success", func(t *testing.T) {

		_ = chdirTemp(t) // Change to a temporary directory

		logger := createLoggerForTest(t)

		file, err := logger.createFile()

		if err != nil {
			t.Fatalf("expected no error, got %v", err)
		}

		defer file.Close()

		// Check if the file was sucessfully created
		path := file.Name()
		parts := splitPath(path)

		nParts := 4

		// Check number of directories
		if len(parts) != nParts {
			t.Fatalf("unexpected path format: %v (len=%d, want=%d)", parts, len(parts), nParts)
		}

		// Logger
		if parts[0] != "logger" {
			t.Fatalf("expected prefix 'logger', got %q", parts[0])
		}

		// Date

		excepetedDate := loggerHandler.Timestamp.Format(loggerHandler.TimestampFormat)

		if parts[1] != excepetedDate {
			t.Fatalf("expected folder '%s', got %q", excepetedDate, parts[2])
		}

		// Filename

		fileName := "order"
		if parts[3] != fileName+".csv" {
			t.Fatalf("expected filename '%s.csv', got %q", fileName, parts[3])
		}

		// File must exist
		if _, err := os.Stat(path); err != nil {
			t.Fatalf("expected file to exist, but got: %v", err)
		}

	})

	t.Run("Failed", func(t *testing.T) {

		_ = chdirTemp(t) // Change to a clean temporary working directory

		logger := createLoggerForTest(t)

		// Create a file named "logger" to block the directory creation.
		// This forces createFile to fail when trying to build the folder hierarchy.
		if err := os.WriteFile("logger", []byte("blocking file"), 0644); err != nil {
			t.Fatalf("precondition failed logger file could not be created: %v", err)
		}

		file, err := logger.createFile()

		// We expect an error
		if err == nil {
			if file != nil {
				file.Close()
			}
			t.Fatalf("expected error, got nil")
		}

		// When there is an error, the returned file must be nil
		if file != nil {
			file.Close()
			t.Fatalf("expected returned file to be nil on error")
		}

	})
}
