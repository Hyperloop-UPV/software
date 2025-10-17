package order

import (
	"fmt"
	"os"
	"path"
	"sync/atomic"
	"time"

	"github.com/HyperloopUPV-H8/h9-backend/pkg/abstraction"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/logger"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/logger/file"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/transport/packet/data"
)

const (
	Name abstraction.LoggerName = "order"
)

type Logger struct {
	// An atomic boolean is used in order to use CompareAndSwap in the Start and Stop methods
	running *atomic.Bool
	writer  *file.CSV
	// save the starting time of the logger in Unix microseconds in order to log relative timestamps
	startTime int64
}

type Record struct {
	Packet    *data.Packet
	From      string
	To        string
	Timestamp time.Time
}

func (*Record) Name() abstraction.LoggerName {
	return Name
}

func NewLogger() *Logger {
	return &Logger{
		running:   &atomic.Bool{},
		writer:    nil,
		startTime: 0,
	}
}

func (sublogger *Logger) Start() error {
	if !sublogger.running.CompareAndSwap(false, true) {
		fmt.Println("Logger already running")
		return nil
	}

	fileRaw, err := sublogger.createFile()
	if err != nil {
		return err
	}

	sublogger.startTime = time.Now().UnixMicro() // Update the start time

	sublogger.writer = file.NewCSV(fileRaw)

	fmt.Println("Logger started")
	return nil
}

func (sublogger *Logger) createFile() (*os.File, error) {
	filename := path.Join(
		"logger",
		logger.Timestamp.Format(logger.TimestampFormat),
		"order",
		"order.csv",
	)

	err := os.MkdirAll(path.Dir(filename), os.ModePerm)
	if err != nil {
		return nil, logger.ErrCreatingAllDir{
			Name:      Name,
			Timestamp: time.Now(),
			Path:      filename,
		}
	}

	return os.Create(filename)
}

func (sublogger *Logger) PushRecord(record abstraction.LoggerRecord) error {
	if !sublogger.running.Load() {
		return logger.ErrLoggerNotRunning{
			Name:      Name,
			Timestamp: time.Now(),
		}
	}

	orderRecord, ok := record.(*Record)
	if !ok {
		return logger.ErrWrongRecordType{
			Name:      Name,
			Timestamp: time.Now(),
			Expected:  &Record{},
			Received:  record,
		}
	}

	err := sublogger.writer.Write([]string{
		fmt.Sprint(orderRecord.Packet.Timestamp().UnixMicro() - sublogger.startTime),
		orderRecord.From,
		orderRecord.To,
		fmt.Sprint(orderRecord.Packet.Id()),
		fmt.Sprint(orderRecord.Packet.GetValues()),
		orderRecord.Timestamp.Format(time.RFC3339),
	})
	sublogger.writer.Flush()
	if err != nil {
		return logger.ErrWritingFile{
			Name:      Name,
			Timestamp: time.Now(),
			Inner:     err,
		}
	}

	return nil
}

func (sublogger *Logger) PullRecord(abstraction.LoggerRequest) (abstraction.LoggerRecord, error) {
	panic("TODO!")
}

func (sublogger *Logger) Stop() error {
	if !sublogger.running.CompareAndSwap(true, false) {
		fmt.Println("Logger already stopped")
		return nil
	}

	err := sublogger.writer.Close()
	if err != nil {
		return logger.ErrClosingFile{
			Name:      Name,
			Timestamp: time.Now(),
		}
	}

	fmt.Println("Logger stopped")
	return nil
}
