package state

import (
	"fmt"
	"os"
	"path"
	"sync/atomic"
	"time"

	"github.com/HyperloopUPV-H8/h9-backend/pkg/abstraction"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/logger"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/logger/file"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/transport/packet/state"
)

const (
	Name abstraction.LoggerName = "state"
)

type Logger struct {
	// An atomic boolean is used in order to use CompareAndSwap in the Start and Stop methods
	running *atomic.Bool
}

type Record struct {
	Packet    *state.Space
	From      string
	To        string
	Timestamp time.Time
}

func (*Record) Name() abstraction.LoggerName {
	return Name
}

func NewLogger() *Logger {
	return &Logger{
		running: &atomic.Bool{},
	}
}

func (sublogger *Logger) Start() error {
	if !sublogger.running.CompareAndSwap(false, true) {
		fmt.Println("Logger already running")
		return nil
	}

	fmt.Println("Logger started")
	return nil
}

func (sublogger *Logger) PushRecord(record abstraction.LoggerRecord) error {
	if !sublogger.running.Load() {
		return logger.ErrLoggerNotRunning{
			Name:      Name,
			Timestamp: time.Now(),
		}
	}

	stateRecord, ok := record.(*Record)
	if !ok {
		return logger.ErrWrongRecordType{
			Name:      Name,
			Timestamp: time.Now(),
			Expected:  &Record{},
			Received:  record,
		}
	}

	saveFile, err := sublogger.createFile(stateRecord.Timestamp)
	if err != nil {
		return err
	}
	defer saveFile.Flush()
	defer saveFile.Close()

	for _, item := range stateRecord.Packet.State() {
		values := make([]string, 0, len(item))
		for _, value := range item {
			values = append(values, fmt.Sprint(value))
		}
		err = saveFile.Write(values)
		if err != nil {
			return logger.ErrWritingFile{
				Name:      Name,
				Timestamp: time.Now(),
				Inner:     err,
			}
		}
	}

	return nil
}

func (sublogger *Logger) createFile(timestamp time.Time) (*file.CSV, error) {
	filename := path.Join(
		"logger",
		logger.Timestamp.Format(logger.TimestampFormat),
		"state",
		fmt.Sprintf("%s.csv", timestamp.Format(logger.TimestampFormat)),
	)

	err := os.MkdirAll(path.Dir(filename), os.ModePerm)
	if err != nil {
		return nil, logger.ErrCreatingAllDir{
			Name:      Name,
			Timestamp: time.Now(),
			Path:      filename,
		}
	}

	fileRaw, err := os.Create(filename)
	return file.NewCSV(fileRaw), err
}

func (sublogger *Logger) PullRecord(abstraction.LoggerRequest) (abstraction.LoggerRecord, error) {
	panic("TODO!")
}

func (sublogger *Logger) Stop() error {
	if !sublogger.running.CompareAndSwap(true, false) {
		fmt.Println("Logger already stopped")
		return nil
	}

	fmt.Println("Logger stopped")
	return nil
}
