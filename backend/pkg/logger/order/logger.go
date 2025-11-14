package order

import (
	"fmt"
	"os"
	"path"
	"time"

	loggerbase "github.com/HyperloopUPV-H8/h9-backend/pkg/logger/base"

	"github.com/HyperloopUPV-H8/h9-backend/pkg/abstraction"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/logger"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/logger/file"
)

const (
	Name abstraction.LoggerName = "order"
)

type Logger struct {
	*loggerbase.BaseLogger

	writer *file.CSV
}

// Record is a struct that implements the abstraction.LoggerRecord interface but we add the Name method
type Record loggerbase.Record

func (*Record) Name() abstraction.LoggerName {
	return Name
}

func NewLogger() *Logger {
	return &Logger{
		BaseLogger: loggerbase.NewBaseLogger(Name),
		writer:     nil,
	}
}

func (sublogger *Logger) Start() error {

	if !sublogger.Running.CompareAndSwap(false, true) {
		fmt.Println("Logger already running")
		return nil
	}
	// Create the file for logging, if the logger was already running
	fileRaw, err := sublogger.createFile()
	if err != nil {
		return err
	}

	sublogger.StartTime = logger.FormatTimestamp(time.Now()) // Update the start time

	sublogger.writer = file.NewCSV(fileRaw)
	fmt.Println("Logger started " + string(sublogger.Name) + ".")
	return nil
}

func (sublogger *Logger) createFile() (*os.File, error) {
	filename := path.Join(
		"logger",
		logger.Timestamp.Format(logger.TimestampFormat),
		"order",
		"order.csv",
	)

	return sublogger.BaseLogger.CreateFile(filename)
}

func (sublogger *Logger) PushRecord(record abstraction.LoggerRecord) error {
	if !sublogger.Running.Load() {
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
		fmt.Sprint(logger.FormatTimestamp(orderRecord.Packet.Timestamp()) - sublogger.StartTime),
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

// Base Stop method with custom close function
func (sublogger *Logger) Stop() error {

	return sublogger.BaseLogger.Stop(func() error {
		err := sublogger.writer.Close()
		if err != nil {
			return logger.ErrClosingFile{
				Name:      Name,
				Timestamp: time.Now(),
			}
		}

		return err
	})
}
