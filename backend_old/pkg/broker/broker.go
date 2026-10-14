package broker

import (
	"github.com/HyperloopUPV-H8/h9-backend/pkg/abstraction"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/broker/topics"
	"github.com/HyperloopUPV-H8/h9-backend/pkg/websocket"
	"github.com/google/uuid"
	"github.com/rs/zerolog"
)

var _ abstraction.Broker = &Broker{}

type Broker struct {
	topics  map[abstraction.BrokerTopic]topics.Handler
	clients *websocket.Pool
	api     abstraction.BrokerAPI

	logger zerolog.Logger
}

func New(baseLogger zerolog.Logger) *Broker {
	return &Broker{
		topics: make(map[abstraction.BrokerTopic]topics.Handler),

		logger: baseLogger,
	}
}

func (broker *Broker) UserPush(push abstraction.BrokerPush) error {
	return broker.api.UserPush(push)
}

func (broker *Broker) UserPull(request abstraction.BrokerRequest) (abstraction.BrokerResponse, error) {
	return broker.api.UserPull(request)
}

func (broker *Broker) Push(push abstraction.BrokerPush) error {
	topic, ok := broker.topics[push.Topic()]
	if !ok {
		broker.logger.Warn().Str("topic", string(push.Topic())).Msg("unrecognized topic")
		return ErrTopicNotFound{
			Topic: push.Topic(),
		}
	}
	broker.logger.Debug().Str("topic", string(push.Topic())).Msg("push")

	return topic.Push(push)
}

func (broker *Broker) Pull(request abstraction.BrokerRequest) (abstraction.BrokerResponse, error) {
	topic, ok := broker.topics[request.Topic()]
	if !ok {
		broker.logger.Warn().Str("topic", string(request.Topic())).Msg("unrecognized topic")
		return nil, ErrTopicNotFound{
			Topic: request.Topic(),
		}
	}
	broker.logger.Debug().Str("topic", string(request.Topic())).Msg("push")

	return topic.Pull(request)
}

func (broker *Broker) SetAPI(api abstraction.BrokerAPI) {
	broker.logger.Trace().Type("api", api).Msg("set api")
	broker.api = api
	for _, topic := range broker.topics {
		topic.SetAPI(broker)
	}
}

func (broker *Broker) SetPool(pool *websocket.Pool) {
	broker.logger.Trace().Msg("set pool")
	broker.clients = pool
	pool.SetOnMessage(broker.onMessage)
	for _, topic := range broker.topics {
		topic.SetPool(pool)
	}
}

func (broker *Broker) AddTopic(topic abstraction.BrokerTopic, handler topics.Handler) {
	broker.logger.Trace().Str("topic", string(topic)).Type("handler", handler).Msg("add topic")
	handler.SetAPI(broker)
	handler.SetPool(broker.clients)
	broker.topics[topic] = handler
}

func (broker *Broker) onMessage(id websocket.ClientId, message *websocket.Message) {
	messageLogger := broker.logger.With().Str("client", uuid.UUID(id).String()).Str("topic", string(message.Topic)).Logger()

	topic, ok := broker.topics[message.Topic]
	if !ok {
		messageLogger.Warn().Msg("unrecognized topic")
		return //TODO: handle error
	}
	messageLogger.Debug().Msg("client message")

	topic.ClientMessage(id, message)
}
