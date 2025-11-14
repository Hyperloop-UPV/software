package protection

import (
	"fmt"
	"os"
	"path"
	"sync"
	"time"

	"github.com/HyperloopUPV-H8/h9-backend/pkg/abstraction"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/logger"
	loggerbase "github.com/HyperloopUPV-H8/h9-backend/pkg/logger/base"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/logger/file"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/transport/packet/protection"
)

const (
	Name abstraction.LoggerName = "protections"
)

type Logger struct {

	// embed the base logger
	*loggerbase.BaseLogger

	// An atomic boolean is used in order to use CompareAndSwap in the Start and Stop methods
	fileLock *sync.Mutex
	// saveFiles is a map that contains the file of each info packet
	saveFiles map[abstraction.BoardId]*file.CSV
	// BoardNames is a map that contains the common name of each board
	boardNames map[abstraction.BoardId]string
	// save the starting time of the logger in Unix microseconds in order to log relative timestamps
}

// Record is a struct that implements the abstraction.LoggerRecord interface
type Record struct {
	Packet    *protection.Packet
	BoardId   abstraction.BoardId
	From      string
	To        string
	Timestamp time.Time
}

func (*Record) Name() abstraction.LoggerName { return Name }

func NewLogger(boardMap map[abstraction.BoardId]string) *Logger {

	fmt.Print("ssfs")
	return &Logger{
		BaseLogger: loggerbase.NewBaseLogger(Name),
		fileLock:   &sync.Mutex{},
		saveFiles:  make(map[abstraction.BoardId]*file.CSV),
		boardNames: boardMap,
	}
}

func (sublogger *Logger) PushRecord(record abstraction.LoggerRecord) error {
	if !sublogger.Running.Load() {
		return logger.ErrLoggerNotRunning{
			Name:      Name,
			Timestamp: time.Now(),
		}
	}

	infoRecord, ok := record.(*Record)
	if !ok {
		return logger.ErrWrongRecordType{
			Name:      Name,
			Timestamp: time.Now(),
			Expected:  &Record{},
			Received:  record,
		}
	}

	saveFile, err := sublogger.getFile(infoRecord.BoardId)
	if err != nil {
		return err
	}

	err = saveFile.Write([]string{
		fmt.Sprint(logger.FormatTimestamp(infoRecord.Timestamp) - sublogger.StartTime),
		infoRecord.From,
		infoRecord.To,
		fmt.Sprint(infoRecord.Packet.Id()),
		fmt.Sprint(infoRecord.Packet.Type),
		fmt.Sprint(infoRecord.Packet.Kind),
		infoRecord.Packet.Name,
		fmt.Sprint(infoRecord.Packet.Data),
		infoRecord.Packet.Timestamp.ToTime().Format(time.RFC3339),
	})
	saveFile.Flush()
	return err
}

func (sublogger *Logger) getFile(boardId abstraction.BoardId) (*file.CSV, error) {
	sublogger.fileLock.Lock()
	defer sublogger.fileLock.Unlock()

	valueFile, ok := sublogger.saveFiles[boardId]
	if ok {
		return valueFile, nil
	}

	valueFileRaw, err := sublogger.createFile(boardId)
	sublogger.saveFiles[boardId] = file.NewCSV(valueFileRaw)

	return sublogger.saveFiles[boardId], err
}

// override createFile from BaseLogger to add specific path
// and filename structure
func (sublogger *Logger) createFile(boardId abstraction.BoardId) (*os.File, error) {
	boardName, ok := sublogger.boardNames[boardId]
	if !ok {
		boardName = fmt.Sprint(boardId)
	}

	filename := path.Join(
		"logger",
		logger.Timestamp.Format(logger.TimestampFormat),
		"protections",
		fmt.Sprintf("%s.csv", boardName),
	)

	return sublogger.BaseLogger.CreateFile(filename)
}

func (sublogger *Logger) Stop() error {

	return sublogger.BaseLogger.Stop(func() error {
		closeErr := error(nil)
		for _, file := range sublogger.saveFiles {
			err := file.Close()
			if err != nil {
				closeErr = logger.ErrClosingFile{
					Name:      Name,
					Timestamp: time.Now(),
				}
				fmt.Println(closeErr.Error())
			}
		}

		sublogger.saveFiles = make(map[abstraction.BoardId]*file.CSV, len(sublogger.saveFiles))

		return closeErr
	})
}
