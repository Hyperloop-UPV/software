package main

import (
	"time"

	"github.com/HyperloopUPV-H8/h9-backend/pkg/abstraction"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/broker"
	connection_topic "github.com/HyperloopUPV-H8/h9-backend/pkg/broker/topics/connection"
	data_topic "github.com/HyperloopUPV-H8/h9-backend/pkg/broker/topics/data"
	logger_topic "github.com/HyperloopUPV-H8/h9-backend/pkg/broker/topics/logger"
	message_topic "github.com/HyperloopUPV-H8/h9-backend/pkg/broker/topics/message"
	order_topic "github.com/HyperloopUPV-H8/h9-backend/pkg/broker/topics/order"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/logger"
	data_logger "github.com/HyperloopUPV-H8/h9-backend/pkg/logger/data"
	trace "github.com/rs/zerolog/log"
)

func configureBroker(subloggers SubloggersMap, loggerHandler *logger.Logger, idToBoard map[abstraction.PacketId]string) (*broker.Broker, func()) {

	broker := broker.New(trace.Logger)

	dataTopic := data_topic.NewUpdateTopic(time.Second / 10)
	cleanup := func() { dataTopic.Stop() }
	connectionTopic := connection_topic.NewUpdateTopic()
	orderTopic := order_topic.NewSendTopic()
	loggerTopic := logger_topic.NewEnableTopic()
	loggerTopic.SetDataLogger(subloggers[data_logger.Name].(*data_logger.Logger))
	loggerHandler.SetOnStart(func() {
		if err := loggerTopic.NotifyStarted(); err != nil {
			trace.Error().Err(err).Msg("failed to notify logger started")
		}
	})

	messageTopic := message_topic.NewUpdateTopic()
	stateOrderTopic := order_topic.NewState(idToBoard, trace.Logger)

	broker.AddTopic(data_topic.UpdateName, dataTopic)
	broker.AddTopic(connection_topic.UpdateName, connectionTopic)
	broker.AddTopic(order_topic.SendName, orderTopic)
	broker.AddTopic(order_topic.StateName, stateOrderTopic)
	broker.AddTopic(logger_topic.EnableName, loggerTopic)
	broker.AddTopic(logger_topic.ResponseName, loggerTopic)
	broker.AddTopic(logger_topic.VariablesName, loggerTopic)
	broker.AddTopic(message_topic.UpdateName, messageTopic)

	return broker, cleanup
}
