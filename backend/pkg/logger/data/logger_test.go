package data

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/HyperloopUPV-H8/h9-backend/pkg/abstraction"
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
			t.Fatal("precondition failed: startTime should be set from the first start")
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

/************************************
* Push Record (and Set Allowed Vars) *
************************************/

func TestPushRecord(t *testing.T) {

	_ = chdirTemp(t) // Change to a temporary directory

	boardName := "Pikachu"

	t.Run("Start and Stop tests", func(t *testing.T) {

		logger := createLoggerForTest(t)

		// Sample data
		valueName := "TEST"

		// Create packet with value
		packet := data.NewPacket(1).
			SetValue(data.ValueName(valueName), data.NewNumericValue(121.232347892347898970234792), true)

		record := Record{
			Packet:    packet,
			From:      boardName,
			To:        "Logger",
			Timestamp: time.Now(),
		}

		t.Run("Without starting the logger", func(t *testing.T) {

			// should return error
			err := logger.PushRecord(&record)

			if err == nil {
				t.Fatalf("expected error, got nil")
			}
		})

		// start the logger
		logger.Start()

		t.Run("Starting the logger", func(t *testing.T) {
			logger.PushRecord(&record)

			// check that the file contains the logged value
			filePath := filepath.Join("logger", loggerHandler.Timestamp.Format(loggerHandler.TimestampFormat), "data", strings.ToUpper(boardName), valueName+".csv")

			// wait until the file is created (DO NOT REMOVE)
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
			if len(fields) < 3 {
				t.Fatalf("CSV line has fewer than 3 fields: %s", line)
			}

			// Take the last 3 fields
			gotTail := fields[len(fields)-3:]

			// Build the expected and check format

			for _, value := range record.Packet.GetValues() {

				expectedValue, _ := value.(numeric)

				expectedTail := []string{
					boardName,
					record.To,
					strconv.FormatFloat(expectedValue.Value(), 'f', -1, 64)}
				// compare
				if fmt.Sprint(gotTail) != fmt.Sprint(expectedTail) {
					t.Fatalf("unexpected CSV line ending.\nGot: %v\nExpected: %v", gotTail, expectedTail)
				}
			}
		})

		// read and store current file contents to compare later
		filePath := filepath.Join("logger", loggerHandler.Timestamp.Format(loggerHandler.TimestampFormat), "data", strings.ToUpper(boardName), valueName+".csv")
		time.Sleep(200 * time.Millisecond) // small wait to stabilize
		beforeBytes, err := os.ReadFile(filePath)
		if err != nil {
			t.Fatalf("could not read file before stopping logger: %v", err)
		}
		before := strings.TrimSpace(string(beforeBytes))

		// stop the logger
		logger.Stop()

		//new packet and record
		packet = data.NewPacket(1).
			SetValue(data.ValueName(valueName), data.NewNumericValue(555.666), true)

		record = Record{
			Packet:    packet,
			From:      boardName,
			To:        "Logger",
			Timestamp: time.Now(),
		}

		t.Run("After stopping the logger", func(t *testing.T) {

			// should return error
			err := logger.PushRecord(&record)
			if err == nil {
				t.Fatalf("expected error when pushing after Stop, got nil")
			}

			// wait a bit and read file again
			time.Sleep(200 * time.Millisecond)
			afterBytes, err := os.ReadFile(filePath)
			if err != nil {
				t.Fatalf("could not read file after pushing post-stop: %v", err)
			}
			after := strings.TrimSpace(string(afterBytes))

			// compare contents: must be identical
			if before != after {
				t.Fatalf("file changed after pushing post-stop.\nBefore: %q\nAfter:  %q", before, after)
			}
		})
	})

	t.Run("Allowed Variables", func(t *testing.T) {

		// create a new logger
		logger := createLoggerForTest(t)
		logger.Start()

		// set allowed variables adding before the boardName and a slash
		allowedVars := []string{"ps", "vel", "esp_ata", "ok"}
		transformed := make([]string, len(allowedVars))
		for i, v := range allowedVars {
			transformed[i] = boardName + "/" + v
		}
		logger.SetAllowedVars(transformed)

		t.Run("With not allowed variable", func(t *testing.T) {

			// generate a packet with a not allowed variable
			invalidValueName := "Victini"
			packet := data.NewPacket(1).
				SetValue(data.ValueName(invalidValueName), data.NewNumericValue(42.0), true)

			record := Record{
				Packet:    packet,
				From:      boardName,
				To:        "Logger",
				Timestamp: time.Now(),
			}

			// Test is not added to allowedVars
			logger.PushRecord(&record)

			//Check that the file does not exist
			filePath := filepath.Join("logger", loggerHandler.Timestamp.Format(loggerHandler.TimestampFormat), "data", strings.ToUpper(record.From), invalidValueName+".csv")

			_, err := os.Stat(filePath)
			if !os.IsNotExist(err) {
				t.Fatalf("expected file %s to not exist, but it does", filePath)
			}
		})

		t.Run("With allowed variable (one variable)", func(t *testing.T) {

			// generate a packet with an allowed variable
			validValueName := "vel"
			packet := data.NewPacket(1).
				SetValue(data.ValueName(validValueName), data.NewNumericValue(99.9), true)

			record := Record{
				Packet:    packet,
				From:      boardName,
				To:        "Logger",
				Timestamp: time.Now(),
			}

			// Test is added to allowedVars
			logger.PushRecord(&record)

			time.Sleep(2 * time.Second)

			//Check that the file exists
			filePath := filepath.Join("logger", loggerHandler.Timestamp.Format(loggerHandler.TimestampFormat), "data", strings.ToUpper(record.From), validValueName+".csv")

			_, err := os.Stat(filePath)
			if err != nil {
				t.Fatalf("expected file %s to exist, but got error: %v", filePath, err)
			}
		})

		t.Run("With allowed variables (multiple variables)", func(t *testing.T) {

			// generate a packet with multiple allowed variables
			packet := data.NewPacket(1).
				SetValue(data.ValueName("ps"), data.NewNumericValue(10.0), true).
				SetValue(data.ValueName("esp_ata"), data.NewNumericValue(20.0), true)

			record := Record{
				Packet:    packet,
				From:      boardName,
				To:        "Logger",
				Timestamp: time.Now(),
			}

			// Tests are added to allowedVars
			logger.PushRecord(&record)

			// give some time for async write to complete
			time.Sleep(2 * time.Second)

			// expected values map
			expected := map[string]float64{
				"ps":      10.0,
				"esp_ata": 20.0,
			}

			//Check that the files exist and contain expected value
			for _, validValueName := range []string{"ps", "esp_ata"} {
				filePath := filepath.Join("logger", loggerHandler.Timestamp.Format(loggerHandler.TimestampFormat), "data", strings.ToUpper(record.From), validValueName+".csv")

				// existencia
				_, err := os.Stat(filePath)
				if err != nil {
					t.Fatalf("expected file %s to exist, but got error: %v", filePath, err)
				}

				// read and validate last field (value)
				b, err := os.ReadFile(filePath)
				if err != nil {
					t.Fatalf("could not read file %s: %v", filePath, err)
				}
				line := strings.TrimSpace(string(b))
				if line == "" {
					t.Fatalf("file %s is empty", filePath)
				}
				fields := strings.Split(line, ",")
				if len(fields) < 1 {
					t.Fatalf("unexpected CSV content in %s: %q", filePath, line)
				}
				got := fields[len(fields)-1]
				want := strconv.FormatFloat(expected[validValueName], 'f', -1, 64)
				if got != want {
					t.Fatalf("unexpected value in %s: got %q, want %q", filePath, got, want)
				}
			}
		})

		// TEST: variables permitidas mixtas (boolean + numeric) con múltiples observaciones
		t.Run("With allowed variables (mixed types, multiple observations)", func(t *testing.T) {
			observations := []struct {
				num float64
				b   bool
			}{
				{1.1, true},
				{2.2, false},
			}

			packet := data.NewPacket(1).
				SetValue(data.ValueName("ps"), data.NewNumericValue(observations[0].num), true).
				SetValue(data.ValueName("ok"), data.NewBooleanValue(observations[0].b), true).
				SetValue(data.ValueName("ps"), data.NewNumericValue(observations[1].num), true).
				SetValue(data.ValueName("ok"), data.NewBooleanValue(observations[1].b), true)

			rec := Record{
				Packet:    packet,
				From:      boardName,
				To:        "Logger",
				Timestamp: time.Now(),
			}
			logger.PushRecord(&rec)

			// time to add
			time.Sleep(2 * time.Second)

			// paths
			numPath := filepath.Join("logger", loggerHandler.Timestamp.Format(loggerHandler.TimestampFormat), "data", strings.ToUpper(boardName), "ps.csv")
			boolPath := filepath.Join("logger", loggerHandler.Timestamp.Format(loggerHandler.TimestampFormat), "data", strings.ToUpper(boardName), "ok.csv")

			// check existence
			if _, err := os.Stat(numPath); err != nil {
				t.Fatalf("expected file %s to exist, but got error: %v", numPath, err)
			}
			if _, err := os.Stat(boolPath); err != nil {
				t.Fatalf("expected file %s to exist, but got error: %v", boolPath, err)
			}

			// check last line of numeric file
			bnum, err := os.ReadFile(numPath)
			if err != nil {
				t.Fatalf("could not read file %s: %v", numPath, err)
			}
			linesNum := strings.Split(strings.TrimSpace(string(bnum)), "\n")
			lastNum := strings.TrimSpace(linesNum[len(linesNum)-1])
			fieldsNum := strings.Split(lastNum, ",")
			gotNum := fieldsNum[len(fieldsNum)-1]
			wantNum := strconv.FormatFloat(observations[len(observations)-1].num, 'f', -1, 64)
			if gotNum != wantNum {
				t.Fatalf("unexpected numeric value in %s: got %q, want %q", numPath, gotNum, wantNum)
			}

			// check last line of boolean file
			bbool, err := os.ReadFile(boolPath)
			if err != nil {
				t.Fatalf("could not read file %s: %v", boolPath, err)
			}
			linesBool := strings.Split(strings.TrimSpace(string(bbool)), "\n")
			lastBool := strings.TrimSpace(linesBool[len(linesBool)-1])
			fieldsBool := strings.Split(lastBool, ",")
			gotBool := fieldsBool[len(fieldsBool)-1]
			wantBool := strconv.FormatBool(observations[len(observations)-1].b)
			if gotBool != wantBool {
				t.Fatalf("unexpected boolean value in %s: got %q, want %q", boolPath, gotBool, wantBool)
			}
		})

		t.Run("With allowed variables (multiple boards, different values Name)", func(t *testing.T) {
			multipleBoardsValueNames(t, []string{"def", "def2"})
		})

		// The same as before but the loggers have the same value Name
		t.Run("With allowed variables (multiple boards, same value Name)", func(t *testing.T) {

			multipleBoardsValueNames(t, []string{"def", "def"})

		})

	})

}

// Test Multiple boards with the valueNames got from input

func multipleBoardsValueNames(t *testing.T, values []string) {

	logger := createLoggerForTest(t)
	logger.Start()

	//variables

	// values to log per board
	vals := map[string]float64{
		"Pikachu":   11.11,
		"Bulbasaur": 22.22,
	}

	// push one record per board using "def" and unique packet IDs
	var id abstraction.PacketId = 1
	for b, v := range vals {
		pkt := data.NewPacket(id).
			SetValue(data.ValueName(values[id-1]), data.NewNumericValue(v), true)
		id++

		rec := Record{
			Packet:    pkt,
			From:      b,
			To:        "Logger",
			Timestamp: time.Now(),
		}

		if err := logger.PushRecord(&rec); err != nil {
			t.Fatalf("PushRecord failed for board %s: %v", b, err)
		}
	}

	// esperar a que terminen las escrituras asíncronas
	time.Sleep(2 * time.Second)

	i := 0

	// comprobar ficheros y valores
	for b, v := range vals {
		filePath := filepath.Join("logger", loggerHandler.Timestamp.Format(loggerHandler.TimestampFormat), "data", strings.ToUpper(b), values[i]+".csv")
		i++
		if _, err := os.Stat(filePath); err != nil {
			t.Fatalf("expected file %s to exist, but got error: %v", filePath, err)
		}

		bts, err := os.ReadFile(filePath)
		if err != nil {
			t.Fatalf("could not read file %s: %v", filePath, err)
		}
		lines := strings.Split(strings.TrimSpace(string(bts)), "\n")
		last := strings.TrimSpace(lines[len(lines)-1])
		fields := strings.Split(last, ",")
		if len(fields) < 1 {
			t.Fatalf("unexpected CSV content in %s: %q", filePath, last)
		}
		got := fields[len(fields)-1]
		want := strconv.FormatFloat(v, 'f', -1, 64)
		if got != want {
			t.Fatalf("unexpected value in %s: got %q, want %q", filePath, got, want)
		}
	}
}

/*************
* Create File *
*************/
func TestCreateFile(t *testing.T) {

	t.Run("Success", runCreateFile_Success)
	t.Run("Failed", runCreateFile_Error_LoggerPathIsFile)

}

// TestCreateFile_Success tests the successful creation of a log file with the correct path structure.
func runCreateFile_Success(t *testing.T) {

	_ = chdirTemp(t) // Change to a temporary directory

	logger := createLoggerForTest(t)

	// Sample data
	boardName := "Pikachu"
	boardNameUpper := strings.ToUpper(boardName)
	valueName := "TEST"

	// creates a test logger, converts the value Name to a value Name
	file, err := logger.createFile(data.ValueName(valueName), boardName)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	defer file.Close()

	path := file.Name()
	parts := splitPath(path)

	// Expected structure: logger / <date> / data / board / valuaName.csv

	nParts := 5
	if len(parts) != nParts {
		t.Fatalf("unexpected path format: %v (len=%d, want=%d)", parts, len(parts), nParts)
	}

	if parts[0] != "logger" {
		t.Fatalf("expected prefix 'logger', got %q", parts[0])
	}

	// parts[1] is the date folder

	if parts[1] != loggerHandler.Timestamp.Format(loggerHandler.TimestampFormat) {
		t.Fatalf("expected folder '%s', got %q", loggerHandler.Timestamp.Format(loggerHandler.TimestampFormat), parts[2])
	}

	if parts[2] != "data" {
		t.Fatalf("expected folder 'data', got %q", parts[2])
	}

	if parts[3] != boardNameUpper {
		t.Fatalf("expected folder '%s', got %q", boardNameUpper, parts[3])
	}

	if parts[4] != valueName+".csv" {
		t.Fatalf("expected filename '%s.csv', got %q", valueName, parts[4])
	}

	// File must exist
	if _, err := os.Stat(path); err != nil {
		t.Fatalf("expected file to exist, but got: %v", err)
	}
}

// TestCreateFile_Error_LoggerPathIsFile tests the scenario where the logger path
// cannot be created because a file exists where a directory is expected.
func runCreateFile_Error_LoggerPathIsFile(t *testing.T) {
	_ = chdirTemp(t) // Change to a clean temporary working directory

	logger := createLoggerForTest(t)

	// Create a file named "logger" to block the directory creation.
	// This forces createFile to fail when trying to build the folder hierarchy.
	if err := os.WriteFile("logger", []byte("blocking file"), 0644); err != nil {
		t.Fatalf("precondition failed: %v", err)
	}

	// Sample data
	boardName := "Pikachu"
	valueName := "TEST"

	file, err := logger.createFile(data.ValueName(valueName), boardName)

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
}
