// Package logger provides logging functionality for the HyperLoop backend.
package logger

import (
	"encoding/json"
	"os"
	"path"
	"sync"
	"sync/atomic"
	"time"

	"github.com/HyperloopUPV-H8/h9-backend/pkg/abstraction"
	"github.com/rs/zerolog"
)

const (
	Name            = "loggerHandler"
	HandlerName     = "logger"
	TimestampFormat = "2006-01-02T15-04-05" // ISO 8601 date for ensuring correct lexicographical order
)

// Logger is a struct that implements the abstraction.Logger interface
type Logger struct {
	// An atomic boolean is used in order to use CompareAndSwap in the Start and Stop methods
	running        *atomic.Bool
	subloggersLock *sync.RWMutex
	// The subloggers are only the loggers selected at the start of the log
	subloggers abstraction.SubloggersMap

	trace zerolog.Logger

	onStart func()
}

/**************
* HandlerLogger *
***************/
var _ abstraction.Logger = &Logger{}

// Timestamp is used on subloggers to get the current timestamp for folder or file names
var Timestamp = time.Now()

// StartAppTimestamp is the time in which the app was started
var StartAppTimestamp = time.Now()

// CommitHash is the commit hash of the current version of ADJ
var CommitHash string

// TimestampUnit is the unit of time used for the logger timestamps
var TimestampUnit TimeUnit

var BasePath = path.Join("logger", StartAppTimestamp.Format(TimestampFormat))

func (Logger) HandlerName() string { return HandlerName }

func NewLogger(keys abstraction.SubloggersMap, baseLogger zerolog.Logger) *Logger {
	trace := baseLogger.Sample(zerolog.LevelSampler{
		TraceSampler: zerolog.RandomSampler(25000),
		DebugSampler: zerolog.RandomSampler(1),
		InfoSampler:  zerolog.RandomSampler(1),
		WarnSampler:  zerolog.RandomSampler(1),
		ErrorSampler: zerolog.RandomSampler(1),
	})

	logger := &Logger{
		running:        &atomic.Bool{},
		subloggersLock: &sync.RWMutex{},
		subloggers:     keys,

		trace: trace,
	}

	logger.running.Store(false)
	return logger
}

func (logger *Logger) Start() error {
	logger.trace.Info().Msg("starting...")
	if !logger.running.CompareAndSwap(false, true) {
		logger.trace.Warn().Msg("already running")
		return nil
	}

	Timestamp = time.Now()

	logger.subloggersLock.Lock()
	defer logger.subloggersLock.Unlock()

	for name, sublogger := range logger.subloggers {
		err := sublogger.Start()
		if err != nil {
			logger.trace.
				Error().
				Stack().
				Err(err).
				Str("subLogger", string(name)).
				Msg("start sublogger")
			return err
		}
	}

	logger.trace.Info().Msg("started")

	// Write logger settings to a JSON file in the sublogger directory
	err := WriteLoggerSettings(path.Join(BasePath, Timestamp.Format(TimestampFormat), "logger_settings.json"))
	if err != nil {
		logger.trace.Warn().Stack().Err(err).Msg("write logger settings")
		return err
	}

	if logger.onStart != nil {
		logger.onStart()
	}
	return nil
}

func (logger *Logger) SetOnStart(cb func()) {
	logger.onStart = cb
}

// PushRecord works as a proxy for the PushRecord method of the subloggers
func (logger *Logger) PushRecord(record abstraction.LoggerRecord) error {

	logger.trace.Trace().Type("record", record).Msg("push")
	sublogger, ok := logger.subloggers[record.Name()]
	if !ok {
		logger.trace.
			Warn().
			Type("record", record).
			Str("name", string(record.Name())).
			Msg("no sublogger found for record")

		return ErrLoggerNotFound{record.Name()}
	}

	return sublogger.PushRecord(record)
}

// ! This method should not be used because any of the subloggers has PullRecord implemented
// // PullRecord works as a proxy for the PullRecord method of the subloggers
func (logger *Logger) PullRecord(request abstraction.LoggerRequest) (abstraction.LoggerRecord, error) {

	panic("PullRecord")

}

func (logger *Logger) Stop() error {
	logger.trace.Info().Msg("stopping...")
	if !logger.running.CompareAndSwap(true, false) {
		logger.trace.Warn().Msg("already stopped")
		return nil
	}

	logger.subloggersLock.Lock()
	defer logger.subloggersLock.Unlock()

	// The wait group is used in order to wait for all the subloggers to stop
	// before closing the main logger
	var wg sync.WaitGroup
	for name := range logger.subloggers {
		wg.Add(1)

		go func(sublogger abstraction.Logger) {
			defer wg.Done()
			_ = sublogger.Stop()
		}(logger.subloggers[name])
	}
	wg.Wait()

	logger.trace.Info().Msg("stopped")
	return nil
}

// ConfigureLogger configures the logger attributes before initializing it.
func ConfigureLogger(unit TimeUnit, basePath string, commitHash string) error {

	// Start the sublogger
	SetFormatTimestamp(unit)

	// Set unit for logger timestamps
	TimestampUnit = unit

	// Set commit hash
	CommitHash = commitHash

	// Update base Path
	BasePath = path.Join(basePath, "logger", StartAppTimestamp.Format(TimestampFormat))

	err := WriteLoggerSettings(path.Join(BasePath, "others", "logger_settings.json"))
	if err != nil {
		return err
	}

	return nil

}

/******************
* Logger Settings *
*******************/

// JSON with adj commit  and unit of time for logger settings
type LoggerSettings struct {
	AdjCommitHash string   `json:"adj_commit_hash"`
	TimeUnit      TimeUnit `json:"time_unit"`
	Time          string   `json:"date"`
}

// WriteLoggerSettings writes the logger settings to a JSON file in the logger directory
func WriteLoggerSettings(filePath string) error {
	settings := LoggerSettings{
		AdjCommitHash: CommitHash,
		TimeUnit:      TimestampUnit,
		Time:          Timestamp.Format(TimestampFormat),
	}

	settingsBytes, err := json.Marshal(settings)
	if err != nil {
		return err
	}

	if err := os.MkdirAll(path.Dir(filePath), os.ModePerm); err != nil {
		return err
	}

	return os.WriteFile(filePath, settingsBytes, 0644)
}
