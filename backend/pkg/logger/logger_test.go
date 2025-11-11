package logger_test

import (
	"testing"

	"os"

	"github.com/HyperloopUPV-H8/h9-backend/pkg/abstraction"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/logger"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/logger/data"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/logger/order"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/logger/protection"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/logger/state"
	"github.com/rs/zerolog"
)

func TestCreateLoggerGroup(t *testing.T) {

	// logger handler
	var loggerHandler *logger.Logger

	// Generate logger group
	t.Run("Create logger group", func(t *testing.T) {
		protectionSublogger := protection.NewLogger(map[abstraction.BoardId]string{
			0: "test",
		})
		loggerHandler = logger.NewLogger(map[abstraction.LoggerName]abstraction.Logger{
			data.Name:       data.NewLogger(),
			order.Name:      order.NewLogger(),
			protection.Name: protectionSublogger,
			state.Name:      state.NewLogger(),
		}, zerolog.New(os.Stdout).With().Timestamp().Logger())

		if err := loggerHandler.Start(); err != nil {
			t.Error(err)
		}
	})

}
