package logger

import (
	"fmt"
	"time"

	"github.com/HyperloopUPV-H8/h9-backend/pkg/abstraction"
)

// TODO! Check methods using value and point receivers for the same function

type ErrLoggerNotFound struct {
	Name abstraction.LoggerName
}

func (err ErrLoggerNotFound) Error() string {
	return fmt.Sprintf("Error %s logger not found", err.Name)
}

type ErrCreatingFile struct {
	Name      abstraction.LoggerName
	Timestamp time.Time
	Inner     error
}

func (err ErrCreatingFile) Error() string {
	return fmt.Sprintf("Error creating file for %s logger at %s", err.Name, err.Timestamp.Format(time.RFC3339))
}

func (err *ErrCreatingFile) Unwrap() error {
	return err.Inner
}

type ErrLoggerNotRunning struct {
	Name      abstraction.LoggerName
	Timestamp time.Time
}

func (err ErrLoggerNotRunning) Error() string {
	return fmt.Sprintf("Error %s logger not running at %s", err.Name, err.Timestamp.Format(time.RFC3339))
}

func (err ErrLoggerNotRunning) Is(other error) bool {
	_, ok := other.(ErrLoggerNotRunning)
	_, okPtr := other.(*ErrLoggerNotRunning)
	return ok || okPtr
}

type ErrWrongRecordType struct {
	Name      abstraction.LoggerName
	Timestamp time.Time
	Expected  abstraction.LoggerRecord
	Received  abstraction.LoggerRecord
}

func (err ErrWrongRecordType) Error() string {
	return fmt.Sprintf("Error wrong record type for %s logger at %s, expected %T, got %T", err.Name, err.Timestamp.Format(time.RFC3339), err.Expected.Name(), err.Received.Name())
}

type ErrStoppingLogger struct {
	Name      abstraction.LoggerName
	Timestamp time.Time
}

func (err ErrStoppingLogger) Error() string {
	return fmt.Sprintf("Error stopping %s logger at %s", err.Name, err.Timestamp.Format(time.RFC3339))
}

type ErrPushingRecord struct {
	Name      abstraction.LoggerName
	Timestamp time.Time
	Inner     error
}

func (err ErrPushingRecord) Error() string {
	return fmt.Sprintf("Error pushing reord in %s logger at %s", err.Name, err.Timestamp.Format(time.RFC3339))
}

func (err *ErrPushingRecord) Unwrap() error { return err.Inner }

type ErrWritingFile struct {
	Name      abstraction.LoggerName
	Timestamp time.Time
	Inner     error
}

func (err ErrWritingFile) Error() string {
	return fmt.Sprintf("Error writing to file in %s logger at %s", err.Name, err.Timestamp.Format(time.RFC3339))
}

func (err *ErrWritingFile) Unwrap() error { return err.Inner }

type ErrClosingFile struct {
	Name      abstraction.LoggerName
	Timestamp time.Time
}

func (err ErrClosingFile) Error() string {
	return fmt.Sprintf("Error closing file in %s logger at %s", err.Name, err.Timestamp.Format(time.RFC3339))
}

type ErrCreatingAllDir struct {
	Name      abstraction.LoggerName
	Timestamp time.Time
	Path      string
}

func (err ErrCreatingAllDir) Error() string {
	return fmt.Sprintf("Error creating the directories for path %s in %s logger at %s", err.Path, err.Name, err.Timestamp.Format(time.RFC3339))
}
