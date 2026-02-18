package logger

import (
	"sync"
	"sync/atomic"
	"time"

	"github.com/HyperloopUPV-H8/h9-backend/pkg/abstraction"
	"github.com/rs/zerolog"
)

const (
	Name            = "loggerHandler"
	HandlerName     = "logger"
	TimestampFormat = "02-Jan-2006_15-04-05.000"
)

// Logger is a struct that implements the abstraction.Logger interface
type Logger struct {
	// An atomic boolean is used in order to use CompareAndSwap in the Start and Stop methods
	running        *atomic.Bool
	subloggersLock *sync.RWMutex
	// The subloggers are only the loggers selected at the start of the log
	subloggers map[abstraction.LoggerName]abstraction.Logger

	trace zerolog.Logger

	onStart func()
}

/**************
* HandlerLogger *
***************/
var _ abstraction.Logger = &Logger{}

// Used on subloggers to get the current timestamp for folder or file names
var Timestamp = time.Now()

var BasePath = "."

func (Logger) HandlerName() string { return HandlerName }

func NewLogger(keys map[abstraction.LoggerName]abstraction.Logger, baseLogger zerolog.Logger) *Logger {
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

	// logger.trace.
	// 	Trace().
	// 	Type("request", request).
	// 	Msg("request")

	// loggerChecked, ok := logger.subloggers[request.Name()]
	// if !ok {
	// 	logger.trace.
	// 		Warn().
	// 		Type("request", request).
	// 		Str("name", string(request.Name())).
	// 		Msg("no subloggger found for request")

	// 	return nil, ErrLoggerNotFound{request.Name()}
	// }
	// return loggerChecked.PullRecord(request)
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

// Configures the logger atributes before inicialicing it
func ConfigureLogger(unit TimeUnit, basePath string) {

	// Start the sublogger
	SetFormatTimestamp(unit)

	// Update base Path
	BasePath = basePath
}
