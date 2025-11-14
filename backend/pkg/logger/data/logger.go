package data

import (
	"fmt"
	"os"
	"path"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/HyperloopUPV-H8/h9-backend/pkg/abstraction"
	loggerHandler "github.com/HyperloopUPV-H8/h9-backend/pkg/logger"
	loggerbase "github.com/HyperloopUPV-H8/h9-backend/pkg/logger/base"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/logger/file"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/transport/packet/data"
)

type loggerAccess string

const (
	Name abstraction.LoggerName = "data"
)

// Logger is a struct that implements the abstraction.Logger interface
type Logger struct {
	*loggerbase.BaseLogger

	fileLock *sync.RWMutex
	// saveFiles is a map that contains the file of each value
	saveFiles map[loggerAccess]*file.CSV
	// allowedVars contains the full names (board/valueName) to be logged
	allowedVars map[string]struct{}
}

// Record is a struct that implements the abstraction.LoggerRecord interface
type Record loggerbase.Record

func (*Record) Name() abstraction.LoggerName { return Name }

func NewLogger() *Logger {
	logger := &Logger{

		BaseLogger:  loggerbase.NewBaseLogger(Name),
		saveFiles:   make(map[loggerAccess]*file.CSV),
		fileLock:    &sync.RWMutex{},
		allowedVars: nil, // no filter by default
	}

	logger.Running.Store(false)
	return logger
}

// SetAllowedVars allows updating the list of allowed variables at runtime
func (sublogger *Logger) SetAllowedVars(allowed []string) {
	allowedMap := make(map[string]struct{}, len(allowed))
	for _, v := range allowed {
		allowedMap[v] = struct{}{}
	}
	sublogger.allowedVars = allowedMap
}

// numeric is an interface that allows to get the value of any numeric format
type numeric interface {
	Value() float64
}

func (sublogger *Logger) PushRecord(record abstraction.LoggerRecord) error {
	if !sublogger.Running.Load() {
		return loggerHandler.ErrLoggerNotRunning{
			Name:      Name,
			Timestamp: time.Now(),
		}
	}

	dataRecord, ok := record.(*Record)
	if !ok {
		return loggerHandler.ErrWrongRecordType{
			Name:      Name,
			Timestamp: time.Now(),
			Expected:  &Record{},
			Received:  record,
		}
	}

	writeErr := error(nil)
	for valueName, value := range dataRecord.Packet.GetValues() {
		// Filter: only log allowed variables
		if sublogger.allowedVars != nil {
			key := dataRecord.From + "/" + string(valueName)
			if _, ok := sublogger.allowedVars[key]; !ok {
				continue
			}
		}
		var valueRepresentation string
		switch value := value.(type) {
		case numeric:
			valueRepresentation = strconv.FormatFloat(value.Value(), 'f', -1, 64)
		case data.BooleanValue:
			valueRepresentation = strconv.FormatBool(value.Value())
		case data.EnumValue:
			valueRepresentation = string(value.Variant())
		}

		saveFile, err := sublogger.getFile(valueName, dataRecord.From)
		if err != nil {
			return err
		}

		err = saveFile.Write([]string{
			fmt.Sprint(loggerHandler.FormatTimestamp(dataRecord.Packet.Timestamp()) - sublogger.StartTime), // Save the timestamp relative to the start time
			dataRecord.From,
			dataRecord.To,
			valueRepresentation,
		})
		saveFile.Flush()

		if err != nil {
			writeErr = loggerHandler.ErrWritingFile{
				Name:      Name,
				Timestamp: time.Now(),
				Inner:     err,
			}
			fmt.Println(writeErr)
		}
	}
	return writeErr
}

// Checks if the file for the given valueName exists, and creates it if it doesn't
func (sublogger *Logger) getFile(valueName data.ValueName, board string) (*file.CSV, error) {
	sublogger.fileLock.Lock()
	defer sublogger.fileLock.Unlock()

	// Takes into account that several boards might have the same valueName,
	valueNameBoard := internalLoggerName(valueName, board)

	// Check if the file already exists
	valueFile, ok := sublogger.saveFiles[valueNameBoard]
	if ok {
		return valueFile, nil
	}

	valueFileRaw, err := sublogger.createFile(valueName, board)
	sublogger.saveFiles[valueNameBoard] = file.NewCSV(valueFileRaw)

	return sublogger.saveFiles[valueNameBoard], err
}

// override createFile from BaseLogger to add specific path
// and filename structure
func (sublogger *Logger) createFile(valueName data.ValueName, board string) (*os.File, error) {
	filename := path.Join(
		"logger",
		loggerHandler.Timestamp.Format(loggerHandler.TimestampFormat),
		"data",
		strings.ToUpper(board),
		fmt.Sprintf("%s.csv", valueName),
	)

	return sublogger.BaseLogger.CreateFile(filename)
}

// Base Stop method with custom close function
func (sublogger *Logger) Stop() error {

	return sublogger.BaseLogger.Stop(func() error {
		closeErr := error(nil)
		for valueName, file := range sublogger.saveFiles {
			err := file.Close()
			if err != nil {
				closeErr = loggerHandler.ErrClosingFile{
					Name:      Name,
					Timestamp: time.Now(),
				}

				fmt.Println(valueName, ": ", closeErr)
			}
		}

		sublogger.saveFiles = make(map[loggerAccess]*file.CSV, len(sublogger.saveFiles))

		return closeErr
	})
}

// This function avoids conflict between two boards that have the same variable to represent
// should be called only when using  saveFiles
func internalLoggerName(valueName data.ValueName, board string) loggerAccess {
	return loggerAccess(string(valueName) + "-" + string(board))
}
