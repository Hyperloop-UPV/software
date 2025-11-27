package loggerbase

import (
	"fmt"
	"os"
	"path"
	"sync/atomic"
	"time"

	"github.com/HyperloopUPV-H8/h9-backend/pkg/abstraction"
	loggerHandler "github.com/HyperloopUPV-H8/h9-backend/pkg/logger"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/transport/packet/data"
)

/*********
* Record *
*********/

type Record struct {
	Packet    *data.Packet
	From      string
	To        string
	Timestamp time.Time
}

/*************
* BaseLogger *
*************/

type BaseLogger struct {

	// An atomic boolean is used in order to use CompareAndSwap in the Start and Stop methods
	Running *atomic.Bool

	// save the starting time of the logger in Unix microseconds in order to log relative timestamps
	StartTime int64

	// Name of the logger
	Name abstraction.LoggerName
}

// Function to start the base logger
func (sublogger *BaseLogger) Start() error {
	if !sublogger.Running.CompareAndSwap(false, true) {
		fmt.Println("Logger already running")
		return nil
	}

	sublogger.StartTime = loggerHandler.FormatTimestamp(time.Now()) // Update the start time

	fmt.Println("Logger started " + string(sublogger.Name) + ".")
	return nil
}

// Function to create the base file path

func (sublogger *BaseLogger) CreateFile(filename string) (*os.File, error) {

	// Includes the direcory specified by the user
	baseFilename := path.Join(loggerHandler.BasePath, filename)

	err := os.MkdirAll(path.Dir(baseFilename), os.ModePerm)
	if err != nil {
		return nil, loggerHandler.ErrCreatingAllDir{
			Name:      sublogger.Name,
			Timestamp: time.Now(),
			Path:      baseFilename,
		}
	}

	return os.Create(path.Join(baseFilename))
}

// Create a base Logger with default values
func NewBaseLogger(name abstraction.LoggerName) *BaseLogger {
	return &BaseLogger{
		Running:   &atomic.Bool{},
		StartTime: 0,
		Name:      name,
	}
}

func (sublogger *BaseLogger) PullRecord(abstraction.LoggerRequest) (abstraction.LoggerRecord, error) {
	panic("TODO!")
}

// Function to stop the base logger
// Param templateStop is a function that contains the specific stop actions of each logger
func (sublogger *BaseLogger) Stop(templateStop func() error) error {
	if !sublogger.Running.CompareAndSwap(true, false) {
		fmt.Println("Logger already stopped" + string(sublogger.Name) + ".")
		return nil
	}

	output := templateStop()

	fmt.Println("Logger stopped " + string(sublogger.Name) + ".")
	return output
}
