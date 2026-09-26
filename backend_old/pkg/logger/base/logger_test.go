package loggerbase

import (
	"os"

	"testing"
)

func createLoggerForTest(t *testing.T) *BaseLogger {

	t.Helper() // Marks this function as a test helper, avoids cluttering test output

	logger := NewBaseLogger("TEST")
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

/*************
* Create File *
*************/

func TestCreateFile(t *testing.T) {

	_ = chdirTemp(t) // Change to a temporary directory
	logger := createLoggerForTest(t)

	t.Run("Create File (valid path)", func(t *testing.T) {
		filename := "logs/testlog.txt"
		file, err := logger.CreateFile(filename)
		if err != nil {
			t.Fatalf("expected nil error, got %v", err)
		}
		defer file.Close()

		// Verify file was created
		if _, err := os.Stat(filename); os.IsNotExist(err) {
			t.Fatalf("expected file %s to exist, but it does not", filename)
		}
	})

	t.Run("Create File (invalid path)", func(t *testing.T) {
		// Using an invalid path (e.g., a path with illegal characters)
		invalidFilename := string([]byte{0}) + "invalidlog.txt"
		_, err := logger.CreateFile(invalidFilename)
		if err == nil {
			t.Fatal("expected an error for invalid path, got nil")
		}
	})
}

/******
* Stop *
******/
func TestStop(t *testing.T) {

	_ = chdirTemp(t) // Change to a temporary directory
	logger := createLoggerForTest(t)

	// Sample stop function
	sampleStopFunc := func() error {
		// Simulate some stop actions
		return nil
	}

	t.Run("Stop (not started)", func(t *testing.T) {

		// Stopping without starting should be a no-op
		out := logger.Stop(sampleStopFunc)
		if out != nil {
			t.Fatalf("expected nil, got %v", out)
		}
	})

	t.Run("Stop (after start)", func(t *testing.T) {

		// Start the logger first
		_ = logger.Start()

		// Now stop the logger
		out := logger.Stop(sampleStopFunc)
		if out != nil {
			t.Fatalf("expected nil, got %v", out)
		}
	})

	t.Run("Stop (already stopped)", func(t *testing.T) {

		// Stopping again should be a no-op
		out := logger.Stop(sampleStopFunc)
		if out != nil {
			t.Fatalf("expected nil, got %v", out)
		}
	})

	// With a function that returns an error
	errorStopFunc := func() error {
		return os.ErrInvalid
	}

	t.Run("Stop (with error)", func(t *testing.T) {

		// Start the logger first
		_ = logger.Start()

		// Now stop the logger with an error-producing function
		out := logger.Stop(errorStopFunc)
		if out != os.ErrInvalid {
			t.Fatalf("expected os.ErrInvalid, got %v", out)
		}
	})

}
