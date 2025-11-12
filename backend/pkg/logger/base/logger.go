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

	fmt.Println("Logger started")
	return nil
}

// Function to create the base file path

func (sublogger *BaseLogger) CreateFile(filename string) (*os.File, error) {

	err := os.MkdirAll(path.Dir(filename), os.ModePerm)
	if err != nil {
		return nil, loggerHandler.ErrCreatingAllDir{
			Name:      sublogger.Name,
			Timestamp: time.Now(),
			Path:      filename,
		}
	}

	return os.Create(path.Join(filename))
}
