package logger_test

import (
	"bufio"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"os"

	"github.com/HyperloopUPV-H8/h9-backend/pkg/abstraction"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/logger"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/logger/data"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/logger/order"
	"github.com/rs/zerolog"

	dataPacketer "github.com/HyperloopUPV-H8/h9-backend/pkg/transport/packet/data"
)

func generatLoggerGroup() *logger.Logger {

	return logger.NewLogger(
		map[abstraction.LoggerName]abstraction.Logger{
			data.Name:  data.NewLogger(),
			order.Name: order.NewLogger(),
		},

		zerolog.
			New(os.Stdout).
			With().
			Timestamp().
			Logger())
}

/************************************
* Mockapplogger for testing purposes *
************************************/

// mockSublogger minimally implements abstraction.Logger for testing error propagation.
type mockSublogger struct {
	startErr error
}

func (m *mockSublogger) Start() error {
	return m.startErr
}
func (m *mockSublogger) Stop() error {
	return nil
}
func (m *mockSublogger) PushRecord(_ abstraction.LoggerRecord) error {
	return nil
}
func (m *mockSublogger) PullRecord(_ abstraction.LoggerRequest) (abstraction.LoggerRecord, error) {
	return nil, nil
}
func (m *mockSublogger) HandlerName() string { return "mock" }

// mockRecord minimally implements Name() required by logger's PushRecord.
type mockRecord struct {
	n abstraction.LoggerName
}

func (r *mockRecord) Name() abstraction.LoggerName { return r.n }

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

/************************************
* Test functions for logger group *
************************************/

func TestCreateLoggerGroup(t *testing.T) {

	_ = chdirTemp(t) // Change to a temporary directory

	// logger handler
	var loggerHandler *logger.Logger

	// Generate logger group
	t.Run("Create logger group", func(t *testing.T) {

		loggerHandler = generatLoggerGroup()

		if loggerHandler == nil {
			t.Errorf("Failed to create logger group")
		}

	})

	t.Run(" Check Name", func(t *testing.T) {

		if loggerHandler.HandlerName() != "logger" {
			t.Errorf("Logger HandlerName() incorrect, got: %s, want: %s", loggerHandler.HandlerName(), "logger")
		}
	})

}

func TestLoggerGroup_Errors(t *testing.T) {

	_ = chdirTemp(t) // Change to a temporary directory

	// Logger with empty map → PushRecord should return error (no sublogger)
	lEmpty := logger.NewLogger(map[abstraction.LoggerName]abstraction.Logger{}, zerolog.New(os.Stdout))
	err := lEmpty.PushRecord(&mockRecord{n: abstraction.LoggerName("missing")})
	if err == nil {
		t.Fatalf("expected error when PushRecord to non-existent sublogger, got nil")
	}

	// Logger whose sublogger returns error on Start → Start should propagate the error
	wantErr := os.ErrPermission
	badMap := map[abstraction.LoggerName]abstraction.Logger{
		abstraction.LoggerName("bad"): &mockSublogger{startErr: wantErr},
	}
	lBad := logger.NewLogger(badMap, zerolog.New(os.Stdout))
	if err := lBad.Start(); err != wantErr {
		t.Fatalf("Start did not propagate the expected error. Got: %v, Want: %v", err, wantErr)
	}
}

func TestStartAndStopLoggerGroup(t *testing.T) {

	_ = chdirTemp(t) // Change to a temporary directory

	// logger handler
	loggerHandler := generatLoggerGroup()

	t.Run("Start logger group", func(t *testing.T) {
		err := loggerHandler.Start()
		if err != nil {
			t.Errorf("Failed to start logger group: %s", err)
		}
	})

	// previous line

	var previousLine string

	// Try to write a log to check if the logger is running

	t.Run("Push Record to logger group", func(t *testing.T) {

		// Data
		dataPacket := dataPacketer.NewPacketWithValues(
			0,
			map[dataPacketer.ValueName]dataPacketer.Value{
				"test": dataPacketer.NewBooleanValue(true),
			},
			map[dataPacketer.ValueName]bool{
				"test": true,
			})
		dataPacketTime := time.Now()
		dataRecord := &data.Record{
			Packet:    dataPacket,
			From:      "test",
			To:        "test",
			Timestamp: dataPacketTime,
		}
		loggerHandler.PushRecord(dataRecord)

		// Read file to ensure it was successfully written

		filePath := filepath.Join("logger", logger.Timestamp.Format(logger.TimestampFormat), "data", "TEST", "test.csv")

		time.Sleep(2 * time.Second) // small wait to stabilize

		_, err := os.Stat(filePath)
		if os.IsNotExist(err) {
			t.Errorf("Failed to write log to file: %s", err)
		}

		// Look last line of the file
		file, err := os.Open(filePath)
		if err != nil {
			t.Errorf("Failed to open log file: %s", err)
		}
		defer file.Close()

		var lastLine string
		scanner := bufio.NewScanner(file)
		for scanner.Scan() {
			lastLine = scanner.Text()
		}

		line := strings.TrimSpace(string(lastLine))
		if line == "" {
			t.Fatalf("file %s is empty", filePath)
		}

		// split the line by commas
		fields := strings.Split(line, ",")
		if len(fields) < 3 {
			t.Fatalf("CSV line has fewer than 3 fields: %s", line)
		}

		// check content
		if fields[1] != "test" {
			t.Errorf("Incorrect Packet ID, got: %s, want: %s", fields[1], "test")
		}

		if fields[2] != "test" {
			t.Errorf("Incorrect Packet ID, got: %s, want: %s", fields[2], "test")
		}

		if fields[3] != "true" {
			t.Errorf("Incorrect Packet Value for 'test', got: %s, want: %s", fields[3], "true")
		}

		previousLine = line

	})

	t.Run("Stop logger group", func(t *testing.T) {
		err := loggerHandler.Stop()
		if err != nil {
			t.Errorf("Failed to stop logger group: %s", err)
		}
	})

	t.Run("Push Record when stopped", func(t *testing.T) {

		// Data
		dataPacket := dataPacketer.NewPacketWithValues(
			0,
			map[dataPacketer.ValueName]dataPacketer.Value{
				"test": dataPacketer.NewBooleanValue(true),
			},
			map[dataPacketer.ValueName]bool{
				"test": true,
			})
		dataPacketTime := time.Now()
		dataRecord := &data.Record{
			Packet:    dataPacket,
			From:      "test",
			To:        "test",
			Timestamp: dataPacketTime,
		}
		loggerHandler.PushRecord(dataRecord)

		// Read file to ensure it was successfully written

		filePath := filepath.Join("logger", logger.Timestamp.Format(logger.TimestampFormat), "data", "TEST", "test.csv")

		time.Sleep(2 * time.Second) // small wait to stabilize

		_, err := os.Stat(filePath)
		if os.IsNotExist(err) {
			t.Errorf("Failed to write log to file: %s", err)
		}

		// Look last line of the file
		file, err := os.Open(filePath)
		if err != nil {
			t.Errorf("Failed to open log file: %s", err)
		}
		defer file.Close()

		var lastLine string
		scanner := bufio.NewScanner(file)
		for scanner.Scan() {
			lastLine = scanner.Text()
		}

		line := strings.TrimSpace(string(lastLine))

		if line != previousLine {
			t.Errorf("Logger wrote a log when stopped, got: %s, want: %s", line, previousLine)
		}

	})
}
